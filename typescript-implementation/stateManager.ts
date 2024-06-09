import { promises as fs } from 'fs';

const STATE_FILE_PATH = 'state.json';

export class StateManager {
    private state: { [topic: string]: any } = {};

    async loadState() {
        try {
            const data = await fs.readFile(STATE_FILE_PATH, 'utf-8');
            this.state = JSON.parse(data);
        } catch (error) {
            console.error(`Error loading state file:`, error);
            this.state = {};
        }
    }

    async saveState() {
        try {
            await fs.writeFile(STATE_FILE_PATH, JSON.stringify(this.state, null, 2), 'utf-8');
        } catch (error) {
            console.error('Error saving state file:', error);
        }
    }

    getTopicState(topic: string) {
        return this.state[topic] || {};
    }

    updateTopicState(topic: string, updates: Partial<{ lastPageChecked: number, lastUpdated: string }>) {
        const now = new Date().toISOString().slice(0, 16);
        this.state[topic] = {
            ...this.state[topic],
            ...updates,
            lastUpdated: now,
        };
    }

    initializeTopicState(topic: string) {
        if (!this.state[topic]) {
            console.log(`First time searching for ${topic}`);
            const now = new Date();
            const localTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
            const formattedDate = localTime.toISOString().slice(0, 16);

            const defaultState = {
                lastPageChecked: 0,
                firstSearchDate: formattedDate,
                lastUpdated: formattedDate,
            };

            this.state[topic] = defaultState;
        }
    }
}
