import React, { useRef, useLayoutEffect } from 'react';
import './OverlapConflictDialog.css';
import { TimelineEvent } from '../types';

export type OverlapStrategy = 'none' | 'push' | 'shorten';

interface OverlapConflictDialogProps {
  isOpen: boolean;
  movedEvent: TimelineEvent | null;
  overlappingEvents: TimelineEvent[];
  onSelectStrategy: (strategy: OverlapStrategy) => void;
  onCancel: () => void;
}

export function OverlapConflictDialog({
  isOpen,
  movedEvent,
  overlappingEvents,
  onSelectStrategy,
  onCancel,
}: OverlapConflictDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && movedEvent && overlappingEvents.length > 0) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, movedEvent, overlappingEvents]);

  if (!isOpen || !movedEvent || overlappingEvents.length === 0) return null;

  return (
    <dialog
      ref={dialogRef}
      className="vt-dialog vt-conflict-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onCancel();
        }
      }}
    >
      <div className="vt-dialog-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--vt-color-warning)', fontSize: '1.2rem' }}>⚠️</span>
          <h3>Event Overlap Detected</h3>
        </div>
        <button type="button" className="vt-dialog-close" onClick={onCancel}>
          &times;
        </button>
      </div>

      <div className="vt-dialog-body">
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--vt-color-text-soft)', lineHeight: 1.5 }}>
          Moving <strong style={{ color: 'var(--vt-color-text)' }}>"{movedEvent.title || 'Untitled Event'}"</strong> causes an overlap with{' '}
          <strong style={{ color: 'var(--vt-color-accent)' }}>{overlappingEvents.length}</strong> event(s) on the track:
        </p>

        {/* Overlapping Event List Badges */}
        <div className="vt-conflict-event-list">
          {overlappingEvents.map((evt) => (
            <div key={evt.id} className="vt-conflict-event-chip">
              <span className="vt-conflict-event-title">{evt.title || 'Untitled Event'}</span>
              <span className="vt-conflict-event-tz">{evt.start.timezone}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--vt-color-text-muted)', marginTop: 8 }}>
          How would you like to handle the overlapping event(s)?
        </div>

        {/* Option Selector Cards */}
        <div className="vt-conflict-options">
          <button
            type="button"
            className="vt-conflict-option-card vt-option-none"
            onClick={() => onSelectStrategy('none')}
          >
            <div className="vt-option-icon">🔵</div>
            <div className="vt-option-text">
              <div className="vt-option-title">Do nothing (creates an overlap)</div>
              <div className="vt-option-desc">
                Keep all events at their target positions. Overlapping events will share track column width.
              </div>
            </div>
          </button>

          <button
            type="button"
            className="vt-conflict-option-card vt-option-push"
            onClick={() => onSelectStrategy('push')}
          >
            <div className="vt-option-icon">🟢</div>
            <div className="vt-option-text">
              <div className="vt-option-title">Push the other event(s) away</div>
              <div className="vt-option-desc">
                Shift overlapping events down in time until all overlaps are cleared.
              </div>
            </div>
          </button>

          <button
            type="button"
            className="vt-conflict-option-card vt-option-shorten"
            onClick={() => onSelectStrategy('shorten')}
          >
            <div className="vt-option-icon">🟡</div>
            <div className="vt-option-text">
              <div className="vt-option-title">Shorten the overlapped event(s)</div>
              <div className="vt-option-desc">
                Truncate the start or end boundary of the overlapping event(s) so they fit flush without overlapping.
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="vt-dialog-footer">
        <button
          type="button"
          className="vt-btn vt-btn-secondary"
          onClick={onCancel}
          style={{ marginLeft: 'auto' }}
        >
          Cancel Move
        </button>
      </div>
    </dialog>
  );
}
