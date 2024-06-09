import axios from "axios";
import { StateManager } from "./stateManager";
import { OrganizationSearcher } from "./OrganizationSearcher";
import { CsvHandler } from "./CsvHandler";

export class OrgFinder {
    private stateManager = new StateManager();
    private orgSearcher = new OrganizationSearcher();
    private csvHandler = new CsvHandler();

    async append(topic: string) {
        await this.stateManager.loadState();
        this.stateManager.initializeTopicState(topic);
        const topicState = this.stateManager.getTopicState(topic);
        let startPage = topicState.lastPageChecked + 1;

        while (true) {
            await this.orgSearcher.searchOrganizationsByCriteria(topic, startPage);
            const organizations = this.orgSearcher.getOrganizations();
            const newDf = await this.processOrganizations(organizations);
            this.csvHandler.setNewDataFrame(newDf);
            await this.csvHandler.exportCsv();
            this.stateManager.updateTopicState(topic, { lastPageChecked: startPage });
            await this.stateManager.saveState();
            startPage++;
        }
    }

    private async processOrganizations(currentOrganizations: any[]) {
        const now = new Date().toISOString();
        const newDf = currentOrganizations.map(item => ({
            name: item,
            github: this.prepareReposPage(`https://github.com/${item}`),
            score: 0,
            hiring: false,
            complexity: 0,
            issues: 0,
            atCore: false,
            hiringProcess: '',
            large: false,
            fetchedAt: now,
        }));

        return newDf;
    }

    private prepareReposPage(url: string): string {
        const query = '?q=&type=all&language=typescript&sort=stargazers';
        return url + query;
    }

    private async getWebsite(api: string): Promise<string> {
        try {
            const response = await axios.get(api, { headers: this.orgSearcher['headers'] });
            if (response.status === 200) {
                const data = response.data;
                return data.blog || '';
            } else {
                console.error(`Error fetching blog site with ${api}`);
                return '';
            }
        } catch (error) {
            console.error(`Error fetching blog site with ${api}`);
            return '';
        }
    }
}
