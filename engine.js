class ObserverModal {
    constructor() {
        this.modal = document.getElementById('observer-modal');
        this.title = document.getElementById('modal-title');
        this.body = document.getElementById('modal-body');
        this.confirmBtn = document.getElementById('modal-confirm');
        this.cancelBtn = document.getElementById('modal-cancel');
    }

    show(title, message, isDanger = false) {
        return new Promise((resolve) => {
            this.title.innerText = title;
            this.body.innerText = message;
            this.modal.classList.remove('hidden');

            if (isDanger) {
                this.confirmBtn.className = 'danger-btn';
            } else {
                this.confirmBtn.className = 'secondary-btn';
                this.confirmBtn.style.background = 'var(--accent-color)';
                this.confirmBtn.style.color = 'var(--bg-color)';
            }

            const cleanup = (result) => {
                this.modal.classList.add('hidden');
                this.confirmBtn.onclick = null;
                this.cancelBtn.onclick = null;
                resolve(result);
            };

            this.confirmBtn.onclick = () => cleanup(true);
            this.cancelBtn.onclick = () => cleanup(false);
        });
    }
}

class ObservationGraph {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    render(observedAtoms, allData, onSelect) {
        if (!this.container) return;
        this.container.innerHTML = '';
        const totalSquares = 140;

        // Automatically generate mapping for all 'atom_' episodes
        const episodes = Object.keys(allData).filter(key => key.startsWith('atom_'));
        const episodeMap = {};
        episodes.forEach((id, index) => {
            // Evenly distribute episodes across the graph
            const pos = Math.floor((index + 1) * (totalSquares / (episodes.length + 1)));
            episodeMap[pos] = { id, title: allData[id].title };
        });

        for (let i = 0; i < totalSquares; i++) {
            const square = document.createElement('div');
            square.className = 'square';

            if (episodeMap[i]) {
                const ep = episodeMap[i];
                const count = observedAtoms.get(ep.id) || 0;

                if (count > 0) {
                    const level = Math.min(count, 4);
                    square.classList.add(`level-${level}`);
                    square.title = `${ep.title} (${count} 관찰)`;
                    square.style.cursor = 'pointer';
                    if (count >= 3) square.style.boxShadow = 'var(--glow)';

                    square.onclick = (e) => {
                        e.stopPropagation();
                        if (onSelect) onSelect(ep.id);
                    };
                } else {
                    square.style.opacity = '0'; // Truly empty if unread
                }
            } else {
                // Background noise linked to global progress
                const globalProgress = (observedAtoms.size || 0) / 6;
                const noiseThreshold = 0.99 - (globalProgress * 0.1);
                if (Math.random() > noiseThreshold && globalProgress > 0) {
                    const level = Math.floor(Math.random() * 2) + 1;
                    square.classList.add(`level-${level}`);
                    square.style.opacity = (Math.random() * 0.15 + 0.05).toString();
                }
            }

            this.container.appendChild(square);
        }
    }
}

class DiaryNarrativeEngine {
    constructor(data) {
        this.data = data;
        this.observedAtoms = new Map(JSON.parse(localStorage.getItem('logged_episodes_v2') || '[]'));

        this.storyViewport = document.getElementById('story-viewport');
        this.narrativeContent = document.getElementById('narrative-content');
        this.diaryList = document.getElementById('diary-list');
        this.actionButtons = document.getElementById('action-buttons');
        this.observedCountLabel = document.getElementById('observed-count');

        this.resetBtn = document.getElementById('reset-btn');
        this.graphBtn = document.getElementById('view-graph-btn');
        this.closeGraphBtn = document.getElementById('close-graph-btn');
        this.listBtn = document.getElementById('view-list-btn');
        this.graphOverlay = document.getElementById('graph-overlay');

        this.modal = new ObserverModal();
        this.graph = new ObservationGraph('github-graph-container');

        this.init();
    }

    init() {
        this.updateHeader();

        if (this.resetBtn) this.resetBtn.addEventListener('click', () => this.confirmRestart());
        if (this.graphBtn) this.graphBtn.addEventListener('click', () => this.toggleGraph(true));
        if (this.closeGraphBtn) this.closeGraphBtn.addEventListener('click', () => this.toggleGraph(false));
        if (this.listBtn) this.listBtn.addEventListener('click', () => this.toggleDiaryList());

        this.graph.render(this.observedAtoms, this.data);

        // Show intro on first visit, or index if already progressing
        if (this.observedAtoms.size === 0) {
            this.loadNode('start');
        } else {
            this.toggleDiaryList();
        }
    }

    saveState() {
        localStorage.setItem('logged_episodes_v2', JSON.stringify(Array.from(this.observedAtoms.entries())));
    }

    updateHeader() {
        const total = Object.keys(this.data).filter(key => key.startsWith('atom_')).length;
        if (this.observedCountLabel) {
            this.observedCountLabel.innerText = `MEMORIES: ${this.observedAtoms.size}/${total}`;
        }
    }

    loadNode(nodeId) {
        const node = this.data[nodeId];
        if (!node) return;

        if (nodeId.startsWith('atom_')) {
            const currentCount = this.observedAtoms.get(nodeId) || 0;
            this.observedAtoms.set(nodeId, currentCount + 1);
            this.saveState();
            this.updateHeader();
        }

        this.renderNode(node);

        if (this.diaryList) this.diaryList.classList.add('hidden');
        if (this.narrativeContent) this.narrativeContent.classList.remove('hidden');
        if (this.storyViewport) {
            this.storyViewport.classList.remove('hidden');
            this.storyViewport.scrollTop = 0; // Scroll to top
        }
    }

    renderNode(node) {
        if (!this.narrativeContent) return;
        this.narrativeContent.classList.remove('fade-in');
        void this.narrativeContent.offsetWidth;
        this.narrativeContent.classList.add('fade-in');

        let html = `<h1>${node.title}</h1>`;

        const formattedContent = node.content
            .replace(/^## (.*$)/gim, '<h2 class="scene-header">$1</h2>')
            .replace(/^### (.*$)/gim, '<h3 class="scene-subheader">$1</h3>')
            .replace(/^- \*\*(.*)\*\*: (.*$)/gim, '<div class="list-item"><strong>$1</strong>: $2</div>')
            .replace(/\[(.*?)\]/g, '<span class="system-msg">[$1]</span>');

        html += `<div class="content-body">${formattedContent}</div>`;
        html += `<div id="inline-actions" class="inline-actions"></div>`;

        this.narrativeContent.innerHTML = html;
        this.renderActions(node.id, node.actions);
    }

    renderActions(nodeId, actions) {
        const actionContainer = document.getElementById('inline-actions');
        if (!actionContainer) return;
        actionContainer.innerHTML = '';

        actions.forEach((action, index) => {
            const btn = document.createElement('button');
            btn.innerText = action.text;
            btn.className = 'primary-btn';
            if (index === 0) btn.style.boxShadow = 'var(--glow)';

            btn.onclick = () => {
                if (action.next === '@index') {
                    this.toggleDiaryList();
                } else if (action.next) {
                    this.loadNode(action.next);
                }
            };
            actionContainer.appendChild(btn);
        });
    }

    toggleDiaryList() {
        const isHidden = this.diaryList.classList.contains('hidden');
        if (isHidden) {
            this.narrativeContent.classList.add('hidden');
            this.diaryList.classList.remove('hidden');
            this.renderDiaryList();
            this.actionButtons.innerHTML = '';
        } else {
            this.narrativeContent.classList.remove('hidden');
            this.diaryList.classList.add('hidden');
            this.loadNode('start');
        }
    }

    renderDiaryList() {
        if (!this.diaryList) return;
        this.diaryList.innerHTML = '';

        // Central Tag Placeholder
        this.centralTag = document.createElement('div');
        this.centralTag.className = 'memory-tag';
        this.diaryList.appendChild(this.centralTag);

        const episodes = Object.keys(this.data)
            .filter(id => id.startsWith('atom_'))
            .sort();

        const coords = [
            { x: 50, y: 50 }, { x: 30, y: 30 }, { x: 70, y: 30 },
            { x: 25, y: 65 }, { x: 65, y: 70 }, { x: 50, y: 20 }
        ];

        episodes.forEach((id, index) => {
            const node = this.data[id];
            const coord = coords[index] || { x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 };

            const dot = document.createElement('div');
            dot.className = 'memory-dot';

            const isRead = this.observedAtoms.has(id);
            if (isRead) dot.classList.add('is-read');

            dot.style.left = `${coord.x}%`;
            dot.style.top = `${coord.y}%`;

            dot.onclick = (e) => {
                e.stopPropagation();
                const isVisible = this.centralTag.classList.contains('is-visible');
                const currentId = this.centralTag.dataset.currentId;

                if (isVisible && currentId === id) {
                    this.loadNode(id); // Move to area directly if focused
                } else {
                    this.showMemoryTag(id, node);
                }
            };
            this.diaryList.appendChild(dot);
        });

        this.diaryList.onclick = () => {
            if (this.centralTag) this.centralTag.classList.remove('is-visible');
        };
    }

    showMemoryTag(id, node) {
        const isVisible = this.centralTag.classList.contains('is-visible');
        const currentId = this.centralTag.dataset.currentId;

        if (isVisible && currentId === id) {
            this.centralTag.classList.remove('is-visible');
            return;
        }

        const summaryText = node.content.substring(0, 150).replace(/[#*]/g, '') + '...';
        this.centralTag.dataset.currentId = id;
        this.centralTag.innerHTML = `
            <div class="tag-close-hint">Focusing Memory... (Click elsewhere to close)</div>
            <h3>${node.title}</h3>
            <div class="tag-summary-content">${summaryText}</div>
            <button class="primary-btn tag-btn">관찰 시작 (READ)</button>
        `;

        const btn = this.centralTag.querySelector('.tag-btn');
        btn.onclick = (e) => {
            e.stopPropagation();
            this.loadNode(id);
        };

        this.centralTag.classList.add('is-visible');
    }
    toggleGraph(show) {
        if (show) {
            this.graphOverlay.classList.remove('hidden');
            this.graph.render(this.observedAtoms, this.data, (nodeId) => {
                this.toggleGraph(false);
                this.loadNode(nodeId);
            });
        } else {
            this.graphOverlay.classList.add('hidden');
        }
    }

    async confirmRestart() {
        const confirmed = await this.modal.show(
            "INITIALIZE MEMORIES",
            "모든 관측 기록을 초기화하시겠습니까?",
            true
        );

        if (confirmed) {
            localStorage.clear();
            location.reload();
        }
    }
}

window.addEventListener('load', () => {
    new DiaryNarrativeEngine(STORY_DATA);
});
