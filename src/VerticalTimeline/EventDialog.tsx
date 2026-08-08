import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import './EventDialog.css';
import {
  TimelineEvent,
  Track,
  CustomPropertyField,
  CustomCurrencyValue,
} from '../types';
import { getSupportedTimezones, getSupportedCurrencies, currencyAsSymbol, toEpochMs, formatISOInTimezone, getSystemTimezone } from '../utils/temporal';

interface EventDialogProps {
  event: TimelineEvent | null;
  tracks: Track[];
  customFields?: CustomPropertyField[];
  isOpen: boolean;
  minDate?: Date;
  maxDate?: Date;
  onClose: () => void;
  onSave: (updatedEvent: TimelineEvent) => void;
  onDelete?: (eventId: string) => void;
}

// Convert Date or ISO string to format required by <input type="datetime-local"> (YYYY-MM-DDTHH:mm:ss)
function toDatetimeLocal(val: Date | string, timezone?: string): string {
  try {
    if (typeof val === 'string') {
      const match = val.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/);
      if (match && !val.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(val)) {
        return match[1];
      }
    }
    const epochMs = toEpochMs(val, timezone);
    if (isNaN(epochMs)) return '';
    return formatISOInTimezone(epochMs, timezone || getSystemTimezone()).slice(0, 19);
  } catch {
    return '';
  }
}

function fromDatetimeLocal(val: string): string {
  return val;
}

export function EventDialog({
  event,
  tracks,
  customFields = [],
  isOpen,
  minDate,
  maxDate,
  onClose,
  onSave,
  onDelete,
}: EventDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const minDatetimeLocal = useMemo(
    () => (minDate ? toDatetimeLocal(minDate) : undefined),
    [minDate]
  );
  const maxDatetimeLocal = useMemo(
    () => (maxDate ? toDatetimeLocal(maxDate) : undefined),
    [maxDate]
  );

  const [trackId, setTrackId] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [startTimezone, setStartTimezone] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [endTimezone, setEndTimezone] = useState('');
  const [customData, setCustomData] = useState<Record<string, unknown>>({});

  const supportedTimezones = useMemo(() => getSupportedTimezones(), []);
  const supportedCurrencies = useMemo(() => getSupportedCurrencies(), []);

  // Filter fields applicable to current selected trackId
  const visibleFields = useMemo(() => {
    return customFields.filter(
      (field) => !field.trackIds || field.trackIds.includes(trackId)
    );
  }, [customFields, trackId]);

  useEffect(() => {
    if (event) {
      const activeTrackId = event.trackId || (tracks[0]?.id ?? '');
      setTrackId(activeTrackId);
      const stz = event.start.timezone || 'UTC';
      const etz = event.end.timezone || 'UTC';
      setStartDateTime(toDatetimeLocal(event.start.dateTime, stz));
      setStartTimezone(stz);
      setEndDateTime(toDatetimeLocal(event.end.dateTime, etz));
      setEndTimezone(etz);

      // Initialize custom data map
      const initialCustom: Record<string, unknown> = { ...(event.data || {}) };
      for (const field of customFields) {
        if (!(field.key in initialCustom)) {
          if (field.type === 'currency') {
            const def = field.defaultValue as CustomCurrencyValue | undefined;
            initialCustom[field.key] = {
              amount: def?.amount ?? 0,
              currencySymbol: def?.currencySymbol ?? '$',
            };
          } else if (field.type === 'enum') {
            initialCustom[field.key] =
              field.defaultValue ?? field.options?.[0] ?? '';
          } else if (field.type === 'number') {
            initialCustom[field.key] = field.defaultValue ?? 0;
          } else if (field.type === 'boolean') {
            initialCustom[field.key] = Boolean(field.defaultValue ?? false);
          } else {
            initialCustom[field.key] = field.defaultValue ?? '';
          }
        }
      }
      setCustomData(initialCustom);
    }
  }, [event, tracks, customFields]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && event) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, event]);

  if (!isOpen || !event) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedCustomData: Record<string, unknown> = { ...customData };
    for (const field of customFields) {
      const rawVal = normalizedCustomData[field.key];
      if (field.type === 'number') {
        normalizedCustomData[field.key] =
          typeof rawVal === 'number'
            ? rawVal
            : rawVal === '' || rawVal === null || rawVal === undefined
            ? 0
            : Number(rawVal) || 0;
      } else if (field.type === 'currency') {
        if (typeof rawVal === 'object' && rawVal !== null) {
          const curr = rawVal as Record<string, unknown>;
          const rawAmt = curr.amount;
          normalizedCustomData[field.key] = {
            currencySymbol: String(curr.currencySymbol || '$'),
            amount:
              typeof rawAmt === 'number'
                ? rawAmt
                : rawAmt === '' || rawAmt === null || rawAmt === undefined
                ? 0
                : Number(rawAmt) || 0,
          };
        }
      }
    }

    const updated: TimelineEvent = {
      ...event,
      trackId,
      start: {
        dateTime: fromDatetimeLocal(startDateTime),
        timezone: startTimezone,
      },
      end: {
        dateTime: fromDatetimeLocal(endDateTime),
        timezone: endTimezone,
      },
      data: normalizedCustomData,
    };
    onSave(updated);
    onClose();
  };

  const handleCustomFieldChange = (key: string, val: unknown) => {
    setCustomData((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <dialog
      ref={dialogRef}
      className="vt-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="vt-dialog-header">
        <h3>Edit Event Details</h3>
        <button type="button" className="vt-dialog-close" onClick={onClose}>
          &times;
        </button>
      </div>

      <form onSubmit={handleSubmit} className="vt-dialog-form">
        <div className="vt-dialog-body">
          {/* Custom Track Properties Section */}
          {visibleFields.length > 0 && (
            <div className="vt-dialog-section vt-dialog-section-first">
              <div className="vt-dialog-section-title">
                Custom Track Properties ({typeof tracks.find((t) => t.id === trackId)?.label === 'string' ? tracks.find((t) => t.id === trackId)?.label : trackId})
              </div>

              {visibleFields.map((field) => {
                const currentValue = customData[field.key];

                if (field.type === 'string') {
                  return (
                    <div key={field.key} className="vt-form-group">
                      <label>{field.label}</label>
                      <input
                        type="text"
                        value={String(currentValue ?? '')}
                        onChange={(e) =>
                          handleCustomFieldChange(field.key, e.target.value)
                        }
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                      />
                    </div>
                  );
                }

                if (field.type === 'link') {
                  return (
                    <div key={field.key} className="vt-form-group">
                      <label>{field.label} (URL)</label>
                      <input
                        type="url"
                        value={String(currentValue ?? '')}
                        onChange={(e) =>
                          handleCustomFieldChange(field.key, e.target.value)
                        }
                        placeholder="https://..."
                      />
                    </div>
                  );
                }

                if (field.type === 'boolean') {
                  return (
                    <div key={field.key} className="vt-form-group vt-checkbox-group">
                      <label className="vt-checkbox-label">
                        <input
                          type="checkbox"
                          checked={Boolean(currentValue)}
                          onChange={(e) =>
                            handleCustomFieldChange(field.key, e.target.checked)
                          }
                        />
                        <span>{field.label}</span>
                      </label>
                    </div>
                  );
                }

                if (field.type === 'enum') {
                  return (
                    <div key={field.key} className="vt-form-group">
                      <label>{field.label}</label>
                      <select
                        value={String(currentValue ?? field.options?.[0] ?? '')}
                        onChange={(e) =>
                          handleCustomFieldChange(field.key, e.target.value)
                        }
                      >
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                if (field.type === 'number') {
                  const numberVal =
                    currentValue === undefined || currentValue === null
                      ? ''
                      : currentValue;

                  return (
                    <div key={field.key} className="vt-form-group">
                      <label>{field.label}</label>
                      <input
                        type="number"
                        value={numberVal as string | number}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleCustomFieldChange(
                            field.key,
                            val === '' ? '' : (isNaN(Number(val)) ? val : Number(val))
                          );
                        }}
                      />
                    </div>
                  );
                }

                if (field.type === 'currency') {
                  const currObj =
                    typeof currentValue === 'object' && currentValue !== null
                      ? (currentValue as Record<string, unknown>)
                      : {
                          amount: typeof currentValue === 'number' ? currentValue : 0,
                          currencySymbol: '$',
                        };

                  const selectedSymbol = String(currObj.currencySymbol || '$');
                  const amountVal =
                    currObj.amount === undefined || currObj.amount === null
                      ? ''
                      : currObj.amount;

                  return (
                    <div key={field.key} className="vt-form-group">
                      <label>{field.label} (Currency & Amount)</label>
                      <div className="vt-currency-input-row">
                        <select
                          className="vt-currency-symbol-input"
                          value={selectedSymbol}
                          onChange={(e) =>
                            handleCustomFieldChange(field.key, {
                              ...currObj,
                              currencySymbol: e.target.value,
                            })
                          }
                        >
                          {!supportedCurrencies.includes(selectedSymbol) && (
                            <option value={selectedSymbol}>{currencyAsSymbol(selectedSymbol)}</option>
                          )}
                          {supportedCurrencies.map((c) => (
                            <option key={c} value={c}>
                              {currencyAsSymbol(c)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          className="vt-currency-amount-input"
                          value={amountVal as string | number}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleCustomFieldChange(field.key, {
                              ...currObj,
                              amount: val === '' ? '' : (isNaN(Number(val)) ? val : Number(val)),
                            });
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}

          {/* Timeline & Track Assignment Section */}
          <div
            className={`vt-dialog-section ${
              visibleFields.length > 0 ? 'vt-dialog-section-divider' : 'vt-dialog-section-first'
            }`}
          >
            <div className="vt-dialog-section-title">Timeline & Track Assignment</div>

            {/* Track Selector */}
            <div className="vt-form-group">
              <label>Track Assignment</label>
              <select
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
              >
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {typeof t.label === 'string' ? t.label : t.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Temporal Range: Start & End */}
            <div className="vt-form-row">
              <div className="vt-form-group">
                <label>Start Date & Time (Sub-resolution)</label>
                <input
                  type="datetime-local"
                  step="1"
                  value={startDateTime}
                  min={minDatetimeLocal}
                  max={maxDatetimeLocal}
                  onChange={(e) => setStartDateTime(e.target.value)}
                  required
                />
              </div>
              <div className="vt-form-group">
                <label>Start Timezone</label>
                <select
                  value={startTimezone}
                  onChange={(e) => setStartTimezone(e.target.value)}
                  required
                >
                  {!supportedTimezones.includes(startTimezone) && (
                    <option value={startTimezone}>{startTimezone}</option>
                  )}
                  {supportedTimezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="vt-form-row">
              <div className="vt-form-group">
                <label>End Date & Time (Sub-resolution)</label>
                <input
                  type="datetime-local"
                  step="1"
                  value={endDateTime}
                  min={minDatetimeLocal}
                  max={maxDatetimeLocal}
                  onChange={(e) => setEndDateTime(e.target.value)}
                  required
                />
              </div>
              <div className="vt-form-group">
                <label>End Timezone</label>
                <select
                  value={endTimezone}
                  onChange={(e) => setEndTimezone(e.target.value)}
                  required
                >
                  {!supportedTimezones.includes(endTimezone) && (
                    <option value={endTimezone}>{endTimezone}</option>
                  )}
                  {supportedTimezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="vt-dialog-footer">
          {onDelete && (
            <button
              type="button"
              className="vt-btn vt-btn-danger"
              onClick={() => {
                onDelete(event.id);
                onClose();
              }}
            >
              Delete Event
            </button>
          )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="vt-btn vt-btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="vt-btn vt-btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        </form>
    </dialog>
  );
}
