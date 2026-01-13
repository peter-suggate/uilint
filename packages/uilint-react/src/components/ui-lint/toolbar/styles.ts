import { TOKENS } from "./tokens";

/**
 * Global CSS styles for toolbar components
 * Uses CSS variables for theme support (light/dark modes)
 */
export const globalStyles = `
  @keyframes uilint-fade-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  
  @keyframes uilint-fade-out {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to { opacity: 0; transform: translateY(8px) scale(0.98); }
  }
  
  @keyframes uilint-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  
  @keyframes uilint-slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes uilint-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .uilint-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 100%;
    padding: 0 14px;
    border: none;
    background: transparent;
    color: ${TOKENS.textSecondary};
    font-family: ${TOKENS.fontFamily};
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: 
      background-color ${TOKENS.transitionFast},
      color ${TOKENS.transitionFast};
    outline: none;
    white-space: nowrap;
  }
  
  .uilint-btn:hover:not(:disabled) {
    background: ${TOKENS.bgHover};
    color: ${TOKENS.textPrimary};
  }
  
  .uilint-btn:active:not(:disabled) {
    background: ${TOKENS.bgActive};
  }
  
  .uilint-btn:focus-visible {
    box-shadow: inset 0 0 0 2px ${TOKENS.borderFocus};
  }
  
  .uilint-btn:disabled {
    cursor: not-allowed;
    color: ${TOKENS.textDisabled};
  }
  
  .uilint-btn--icon {
    padding: 0;
    min-width: ${TOKENS.buttonMinWidth};
  }
  
  .uilint-btn--primary {
    color: ${TOKENS.textPrimary};
  }
  
  .uilint-btn--accent {
    color: ${TOKENS.accent};
  }
  
  .uilint-btn--warning {
    color: ${TOKENS.warning};
  }
  
  .uilint-btn--success {
    color: ${TOKENS.success};
  }
  
  .uilint-popover {
    animation: uilint-fade-in ${TOKENS.transitionSlow} forwards;
  }
  
  .uilint-popover--closing {
    animation: uilint-fade-out ${TOKENS.transitionBase} forwards;
  }
  
  .uilint-scanning-bar {
    animation: uilint-slide-up ${TOKENS.transitionSlow} forwards;
  }
  
  .uilint-scanning-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${TOKENS.accent};
    animation: uilint-pulse 1.5s ease-in-out infinite;
  }

  /* Scrollbar styling - uses CSS variables for theme support */
  [data-ui-lint] * {
    scrollbar-width: thin;
    scrollbar-color: var(--uilint-scrollbar-thumb) var(--uilint-scrollbar-track);
  }
  
  [data-ui-lint] *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  [data-ui-lint] *::-webkit-scrollbar-track {
    background: var(--uilint-scrollbar-track);
    border-radius: 4px;
  }
  
  [data-ui-lint] *::-webkit-scrollbar-thumb {
    background: var(--uilint-scrollbar-thumb);
    border-radius: 4px;
  }
  
  [data-ui-lint] *::-webkit-scrollbar-thumb:hover {
    background: var(--uilint-scrollbar-thumb-hover);
  }
`;
