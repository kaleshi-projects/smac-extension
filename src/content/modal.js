// src/content/modal.js

const POST_INTENTS = [
    { key: 'congratulate', label: '🎉 Congratulate' },
    { key: 'congrats_collab', label: '🤝 Congratulate + Open to Collaborate' },
    { key: 'insight', label: '💡 Add Insight / Build on Their Point' },
    { key: 'question', label: '❓ Ask a Thoughtful Question' },
    { key: 'agree_amplify', label: '📢 Agree & Amplify' },
    { key: 'supportive', label: '💙 Supportive / Encouraging' },
    { key: 'disagree', label: '🔄 Respectfully Disagree' },
];

const PROFILE_INTENTS = [
    { key: 'normal_connect', label: '🙋 Normal Connection Request' },
    { key: 'collab', label: '🤝 Open to Collaborate' },
    { key: 'job_pitch', label: '💼 Job / Freelance Pitch' },
    { key: 'informational', label: '📚 Learn from Them' },
    { key: 'mutual_interest', label: '🔗 Shared Interest' },
    { key: 'follow_up', label: '📩 Follow Up' },
];

const MESSAGE_INTENTS_EMPTY = [
    { key: 'new_intro', label: '👋 Start a Conversation' },
    { key: 'job_inquiry', label: '💼 Job / Opportunity Inquiry' },
];

const MESSAGE_INTENTS_ACTIVE = [
    { key: 'reply_natural', label: '💬 Natural Reply' },
    { key: 'reply_professional', label: '🏢 Professional Reply' },
    { key: 'reply_follow_up', label: '📌 Follow Up (no response yet)' },
    { key: 'reply_decline', label: '🚫 Politely Decline' },
    { key: 'reply_schedule', label: '📅 Suggest a Meeting' },
];

export function showIntentModal(mode, isEmptyThread = false) {
    return new Promise((resolve) => {
        document.getElementById('smac-modal-host')?.remove();

        let intents;
        if (mode === 'post') intents = POST_INTENTS;
        else if (mode === 'profile') intents = PROFILE_INTENTS;
        else intents = isEmptyThread ? MESSAGE_INTENTS_EMPTY : MESSAGE_INTENTS_ACTIVE;

        const modeLabel = mode === 'post' ? 'comment' : mode === 'profile' ? 'outreach message' : 'message';
        const host = document.createElement('div');
        host.id = 'smac-modal-host';
        host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;';
        document.body.appendChild(host);

        const shadow = host.attachShadow({ mode: 'closed' });
        let isDismissed = false;

        const onKey = (e) => {
            if (e.key === 'Escape') dismiss(null);
        };

        const dismiss = (value) => {
            if (isDismissed) return;
            isDismissed = true;
            document.removeEventListener('keydown', onKey);
            host.remove();
            resolve(value);
        };

        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.6);
            display:flex;align-items:center;justify-content:center;
        `;
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) dismiss(null);
        });

        const modal = document.createElement('div');
        modal.style.cssText = `
            background:#1e293b;border-radius:14px;padding:24px;
            width:320px;max-height:80vh;overflow-y:auto;
            box-shadow:0 25px 50px rgba(0,0,0,0.5);
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        `;

        const title = document.createElement('p');
        title.style.cssText = 'margin:0 0 16px;color:#e2e8f0;font-size:14px;font-weight:600;';
        title.textContent = `What kind of ${modeLabel} do you want?`;
        modal.appendChild(title);

        intents.forEach(({ label }) => {
            const btn = document.createElement('button');
            btn.style.cssText = `
                display:block;width:100%;text-align:left;padding:10px 14px;
                margin-bottom:8px;background:#0f172a;color:#e2e8f0;
                border:1px solid #334155;border-radius:8px;cursor:pointer;
                font-size:13px;font-family:inherit;transition:background 0.15s;
            `;
            btn.textContent = label;
            btn.onmouseenter = () => { btn.style.background = '#334155'; };
            btn.onmouseleave = () => { btn.style.background = '#0f172a'; };
            btn.addEventListener('click', () => dismiss(label));
            modal.appendChild(btn);
        });

        const cancel = document.createElement('button');
        cancel.style.cssText = `
            display:block;width:100%;padding:8px;margin-top:4px;
            background:transparent;color:#64748b;border:none;
            cursor:pointer;font-size:12px;font-family:inherit;
        `;
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => dismiss(null));
        modal.appendChild(cancel);

        backdrop.appendChild(modal);
        shadow.appendChild(backdrop);
        document.addEventListener('keydown', onKey);
    });
}
