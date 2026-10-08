/**
 * Client half of the i-have-adhd bundle.
 *
 * One ambient entry below the composer card, shown only while the session's
 * projection says the mode is on. The value arrives already computed from the
 * Host's `wire.view`; this module folds no session events itself.
 *
 * Styling uses theme tokens only (`--dsw-alias-*`), so the badge follows light
 * and dark like the host chrome. No Harness Client package is imported: the
 * primitives change without notice and a throw here would blank the slot entry.
 */
window.__ModuleLoader__.load({
  id: 'dsh-adhd-session-mode',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const ROW = {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '2px 10px',
      fontSize: '11px',
      lineHeight: '16px',
      color: 'var(--dsw-alias-label-secondary)',
      userSelect: 'none',
    };
    const DOT = {
      fontSize: '9px',
      lineHeight: '16px',
      color: 'var(--dsw-alias-state-success-primary)',
    };

    /**
     * @param props - standard slot props for `conversation.composer.dock`.
     * @returns the badge, or null while the mode is off or the value is unknown.
     */
    function AdhdBadge({ useProjection }) {
      const state = useProjection('i-have-adhd');
      if (state === undefined || state === null || state.enabled !== true) return null;
      return h(
        'div',
        { style: ROW, title: 'ADHD mode is on. Type "stop adhd mode" to turn it off.' },
        h('span', { style: DOT, 'aria-hidden': true }, '\u25CF'),
        h('span', null, 'ADHD ON'),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'i-have-adhd',
          order: 40,
        }, AdhdBadge));
      },
    };
  },
});
