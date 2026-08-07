export const verticalTimelineStyles = `
.vertical-timeline {
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 500px;
  background-color: #0f172a;
  color: #f8fafc;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid #334155;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
  user-select: none;
}

.vt-header {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 20;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  backdrop-filter: blur(12px);
}

.vt-header-time-axis {
  width: 160px;
  min-width: 160px;
  display: flex;
  border-right: 1px solid #334155;
  background: #1e293b;
  box-sizing: border-box;
}

.vt-header-day-subcol,
.vt-header-time-subcol {
  flex: 1;
  width: 80px;
  padding: 10px 6px;
  font-size: 0.725rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.vt-header-day-subcol {
  border-right: 1px solid #334155;
  color: #818cf8;
}

.vt-header-tracks {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.vt-track-header {
  flex: 1;
  min-width: 160px;
  padding: 10px 16px;
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
}

.vt-track-header:last-child {
  border-right: none;
}

.vt-track-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: #f8fafc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vt-track-subtitle {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vt-body-scroll {
  display: flex;
  flex: 1;
  overflow: auto;
  position: relative;
}

.vt-time-axis-column {
  width: 160px;
  min-width: 160px;
  position: sticky;
  left: 0;
  z-index: 15;
  background: #0f172a;
  border-right: 1px solid #334155;
  display: flex;
  pointer-events: none;
  box-sizing: border-box;
}

.vt-day-column {
  width: 80px;
  min-width: 80px;
  position: relative;
  border-right: 1px solid #334155;
  box-sizing: border-box;
}

.vt-day-block {
  position: absolute;
  left: 0;
  right: 0;
  border-bottom: 2px solid #334155;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 10px;
  background: rgba(15, 23, 42, 0.6);
}

.vt-day-label {
  position: sticky;
  top: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(30, 41, 59, 0.85);
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid rgba(129, 140, 248, 0.3);
  backdrop-filter: blur(8px);
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
}

.vt-day-weekday {
  font-size: 0.65rem;
  font-weight: 700;
  color: #818cf8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 1.1;
}

.vt-day-date {
  font-size: 0.75rem;
  font-weight: 600;
  color: #f8fafc;
  margin-top: 2px;
  line-height: 1.1;
}

.vt-time-column {
  flex: 1;
  width: 80px;
  min-width: 80px;
  position: relative;
  box-sizing: border-box;
}

.vt-time-slot-label {
  position: absolute;
  left: 0;
  right: 0;
  padding: 4px 8px;
  font-size: 0.725rem;
  font-weight: 500;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vt-tracks-container {
  display: flex;
  flex: 1;
  position: relative;
  min-width: fit-content;
}

.vt-track-column {
  flex: 1;
  min-width: 160px;
  position: relative;
  border-right: 1px solid #334155;
  box-sizing: border-box;
  background: radial-gradient(circle at top, rgba(255, 255, 255, 0.01) 0%, transparent 100%);
}

.vt-track-column:last-child {
  border-right: none;
}

.vt-grid-slot {
  position: absolute;
  left: 0;
  right: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  box-sizing: border-box;
  pointer-events: auto;
  transition: background-color 0.15s ease;
}

.vt-grid-slot:hover {
  background-color: rgba(255, 255, 255, 0.03);
  cursor: pointer;
}

/* Timeline Events */
.vt-event {
  position: absolute;
  box-sizing: border-box;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.25);
  border: 1px solid rgba(129, 140, 248, 0.6);
  color: #e0e7ff;
  padding: 6px 10px;
  font-size: 0.8rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(4px);
  overflow: hidden;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
  z-index: 5;
  display: flex;
  flex-direction: column;
}

.vt-event.is-compact {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  justify-content: center;
}

.vt-event:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  border-color: #a5b4fc;
  z-index: 10;
}

.vt-event.is-draggable {
  cursor: grab;
}

.vt-event.is-dragging {
  opacity: 0.8;
  cursor: grabbing !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  z-index: 30 !important;
}

.vt-event-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.vt-event-title {
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vt-event-tz-badge {
  font-size: 0.65rem;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  font-weight: 500;
  flex-shrink: 0;
}

.vt-event-desc {
  font-size: 0.725rem;
  color: #cbd5e1;
  margin-top: 4px;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  opacity: 0.9;
}

.vt-event-time {
  font-size: 0.675rem;
  color: #94a3b8;
  margin-top: 4px;
}

/* Resize Handles */
.vt-resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vt-resize-handle-top {
  top: 0;
}

.vt-resize-handle-bottom {
  bottom: 0;
}

.vt-resize-handle::after {
  content: '';
  width: 20px;
  height: 3px;
  border-radius: 2px;
  background-color: rgba(255, 255, 255, 0.4);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.vt-event:hover .vt-resize-handle::after {
  opacity: 1;
}

/* Event Editing Dialog Modal */
.vt-dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: vtFadeIn 0.2s ease-out;
}

.vt-dialog {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  color: #f8fafc;
  animation: vtSlideUp 0.2s ease-out;
}

@keyframes vtFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes vtSlideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.vt-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #0f172a;
}

.vt-dialog-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #f8fafc;
}

.vt-dialog-close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}

.vt-dialog-close:hover {
  color: #f8fafc;
}

.vt-dialog-form {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.vt-dialog-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.vt-dialog-section {
  border-top: 1px solid #334155;
  padding-top: 16px;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.vt-dialog-section-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #818cf8;
  margin-bottom: 4px;
}

.vt-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.vt-checkbox-group {
  margin-top: 4px;
}

.vt-checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.85rem !important;
  color: #f8fafc !important;
}

.vt-checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  cursor: pointer;
}

.vt-form-group label {
  font-size: 0.8rem;
  font-weight: 500;
  color: #cbd5e1;
}

.vt-form-group input[type="text"],
.vt-form-group input[type="url"],
.vt-form-group input[type="number"],
.vt-form-group input[type="datetime-local"],
.vt-form-group select,
.vt-form-group textarea {
  background: #0f172a;
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 8px 12px;
  color: #f8fafc;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s ease;
  font-family: inherit;
}

.vt-form-group input:focus,
.vt-form-group select:focus,
.vt-form-group textarea:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.vt-form-row {
  display: flex;
  gap: 12px;
}

.vt-currency-input-row {
  display: flex;
  gap: 8px;
}

.vt-currency-symbol-input {
  width: 90px !important;
  text-align: center;
  font-weight: 600;
  color: #818cf8 !important;
}

.vt-currency-amount-input {
  flex: 1;
}

.vt-dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #334155;
  display: flex;
  align-items: center;
  background: #0f172a;
}

.vt-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.vt-btn-primary {
  background: #6366f1;
  color: #ffffff;
}

.vt-btn-primary:hover {
  background: #4f46e5;
}

.vt-btn-secondary {
  background: #334155;
  color: #cbd5e1;
}

.vt-btn-secondary:hover {
  background: #475569;
  color: #f8fafc;
}

.vt-btn-danger {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.vt-btn-danger:hover {
  background: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

/* Overlap Conflict Dialog Styles */
.vt-conflict-dialog {
  max-width: 540px !important;
}

.vt-conflict-event-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.vt-conflict-event-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(99, 102, 241, 0.2);
  border: 1px solid rgba(129, 140, 248, 0.4);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.775rem;
  color: #e0e7ff;
}

.vt-conflict-event-title {
  font-weight: 600;
}

.vt-conflict-event-tz {
  font-size: 0.65rem;
  opacity: 0.8;
  background: rgba(255, 255, 255, 0.15);
  padding: 1px 4px;
  border-radius: 3px;
}

.vt-conflict-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.vt-conflict-option-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  color: #f8fafc;
}

.vt-conflict-option-card:hover {
  background: #1e293b;
  border-color: #6366f1;
  transform: translateY(-1px);
}

.vt-option-icon {
  font-size: 1.2rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.vt-option-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: #f8fafc;
  margin-bottom: 2px;
}

.vt-option-desc {
  font-size: 0.775rem;
  color: #94a3b8;
  line-height: 1.35;
}
`;
