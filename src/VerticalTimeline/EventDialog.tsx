import React, { useState, useEffect, useMemo } from 'react';
import {
  TimelineEvent,
  Track,
  CustomPropertyField,
  CustomCurrencyValue,
} from '../types';
import { getSupportedTimezones, getSupportedCurrencies, currencyAsSymbol } from '../utils/temporal';

interface EventDialogProps {
  event: TimelineEvent | null;
  tracks: Track[];
  customFields?: CustomPropertyField[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEvent: TimelineEvent) => void;
  onDelete?: (eventId: string) => void;
}

// Convert Date or ISO string to format required by <input type="datetime-local"> (YYYY-MM-DDTHH:mm:ss)
function toDatetimeLocal(val: Date | string): string {
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());
    const secs = pad(d.getSeconds());
    return `${year}-${month}-${day}T${hours}:${mins}:${secs}`;
  } catch {
    return '';
  }
}

function fromDatetimeLocal(val: string): string {
  try {
    const d = new Date(val);
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function EventDialog({
  event,
  tracks,
  customFields = [],
  isOpen,
  onClose,
  onSave,
  onDelete,
}: EventDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
      setTitle(event.title || '');
      setDescription(event.description || '');
      const activeTrackId = event.trackId || (tracks[0]?.id ?? '');
      setTrackId(activeTrackId);
      setStartDateTime(toDatetimeLocal(event.start.dateTime));
      setStartTimezone(event.start.timezone || 'UTC');
      setEndDateTime(toDatetimeLocal(event.end.dateTime));
      setEndTimezone(event.end.timezone || 'UTC');

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

  if (!isOpen || !event) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TimelineEvent = {
      ...event,
      title,
      description,
      trackId,
      start: {
        dateTime: fromDatetimeLocal(startDateTime),
        timezone: startTimezone,
      },
      end: {
        dateTime: fromDatetimeLocal(endDateTime),
        timezone: endTimezone,
      },
      data: customData,
    };
    onSave(updated);
    onClose();
  };

  const handleCustomFieldChange = (key: string, val: unknown) => {
    setCustomData((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="vt-dialog-backdrop" onClick={onClose}>
      <div className="vt-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="vt-dialog-header">
          <h3>Edit Event Details</h3>
          <button type="button" className="vt-dialog-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vt-dialog-form">
          <div className="vt-dialog-body">
            {/* Title */}
            <div className="vt-form-group">
              <label>Event Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter event title..."
                required
              />
            </div>

            {/* Description */}
            <div className="vt-form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description..."
                rows={2}
              />
            </div>

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

            {/* Custom Properties Section */}
            {visibleFields.length > 0 && (
              <div className="vt-dialog-section">
                <div className="vt-dialog-section-title">
                  Custom Track Properties ({tracks.find((t) => t.id === trackId)?.label})
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
                    return (
                      <div key={field.key} className="vt-form-group">
                        <label>{field.label}</label>
                        <input
                          type="number"
                          value={Number(currentValue ?? 0)}
                          onChange={(e) =>
                            handleCustomFieldChange(
                              field.key,
                              Number(e.target.value)
                            )
                          }
                        />
                      </div>
                    );
                  }

                  if (field.type === 'currency') {
                    const currObj =
                      typeof currentValue === 'object' && currentValue !== null
                        ? (currentValue as CustomCurrencyValue)
                        : {
                            amount: typeof currentValue === 'number' ? currentValue : 0,
                            currencySymbol: '$',
                          };

                    const selectedSymbol = currObj.currencySymbol || '$';

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
                            value={currObj.amount ?? 0}
                            onChange={(e) =>
                              handleCustomFieldChange(field.key, {
                                ...currObj,
                                amount: Number(e.target.value),
                              })
                            }
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
      </div>
    </div>
  );
}
