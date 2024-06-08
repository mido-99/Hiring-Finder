import axios from 'axios';
import { createReadStream, promises as fs } from 'fs';
import * as createCsvWriter from 'csv-writer';
import createCsvReader from 'csv-parser';
import * as path from 'path';

const STATE_FILE_PATH = 'state.json';
const ORGANIZATION_LIST_PATH = 'organizations_list.csv';
const REPOS_PER_PAGE = 100;
export class OrgFinder {
    private token: string | undefined;
    private headers: any;
    private organizations: any[];
    private newDf: any[];
    private state: { [topic: string]: any } = {};

    constructor() {
        this.token = process.env.GITHUB_TOKEN;
        this.headers = { 'Accept': 'application/vnd.github.v3+json' };
        if (this.token) {
            this.headers['Authorization'] = `token ${this.token}`;
        }
        this.organizations = [];
        this.newDf = [];
        this.loadState().then(state => {
            this.state = state
        })
    }

    async append(topic: string) {
        const topicState = await this.getTopicState(topic);
        let startPage = topicState.lastPageChecked + 1;

        while (true) {
            await this.searchOrganizationsByCriteria(topic, startPage);
            await this.populateTable();
            await this.exportCsv();
            this.updateState(topic, { lastPageChecked: startPage });
            await this.saveState();
            startPage++;
        }
    }

    private async getTopicState(topic: string) {
        const topicState = this.state[topic];

        if (!topicState) {
            console.log(`First time searching for ${topic}`)
            const now = new Date();
            const localTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
            const formattedDate = localTime.toISOString().slice(0, 16);

            const defaultState = {
                lastPageChecked: 0,
                firstSearchDate: formattedDate,
                lastUpdated: formattedDate,
            };

            this.state[topic] = defaultState;
            await this.saveState();
        }

        return this.state[topic];
    }

    private async loadState() {
        try {
            const data = await fs.readFile(STATE_FILE_PATH, 'utf-8');
            const json = JSON.parse(data);
            return json || {};
        } catch (error) {
            console.error(`Error loading state file":`, error);
            return {};
        }
    }

    private updateState(topic: string, updates: Partial<{ lastPageChecked: number, lastUpdated: string }>) {
        const now = new Date().toISOString().slice(0, 16);
        this.state[topic] = {
            ...this.state[topic],
            ...updates,
            lastUpdated: now,
        };
    }

    private async saveState() {
        try {
            await fs.writeFile(STATE_FILE_PATH, JSON.stringify(this.state, null, 2), 'utf-8');
        } catch (error) {
            console.error('Error saving state file:', error);
        }
    }

    private async searchOrganizationsByCriteria(topic: string, page: number) {
        const baseUrl = 'https://api.github.com/search/repositories';
        const existingOrgs = await this.loadExistingOrganizations();

        const params = {
            q: `topic:${topic}`,
            per_page: REPOS_PER_PAGE,
            page: page,
        };

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const response = await axios.get(baseUrl, { headers: this.headers, params: params });
            if (response.status === 200) {
                const data = response.data;
                const newOrgs = data.items.map((item: any) => item.owner).filter((owner: any) => !existingOrgs.includes(owner.login));
                this.organizations.push(...newOrgs);
                console.log(`Found total of ${data.total_count} repositories for topic ${topic}`);
            } else {
                console.error(`Error in request to page: ${page}: ${response.status} - ${response.data}`);
            }
        } catch (error) {
            console.error(`Error in request to page: ${page}: ${error}`);
        }
    }

    private async loadExistingOrganizations(): Promise<string[]> {
        const orgs: string[] = [];
        try {
            const csvFilePath = path.resolve(__dirname, ORGANIZATION_LIST_PATH);
            await new Promise((resolve, reject) => {
                createReadStream(csvFilePath)
                    .pipe(createCsvReader())
                    .on('data', (row: any) => orgs.push(row.name))
                    .on('end', resolve)
                    .on('error', reject);
            });
        } catch (error) {
            console.error('Error loading existing organizations:', error);
        }
        return orgs;
    }

    private async populateTable() {
        const currentOrganizations = this.organizations;
        await this.processCurrentOrganizations(currentOrganizations);
    }

    private async processCurrentOrganizations(currentOrganizations: any[]) {
        const now = new Date().toISOString();
        this.newDf = currentOrganizations.map(item => ({
            name: item.login,
            github: this.prepareReposPage(item.html_url),
            api: item.url,
            website: '',
            review: {
                score: 0,
                hiring: false,
                complexity: 0,
                issues: 0,
                atCore: false,
                hiringProcess: '',
                large: false
            },
            fetchedAt: now,
        }));

        this.newDf = await Promise.all(this.newDf.map(async item => {
            item.website = await this.getWebsite(item.api);
            return item;
        }));
    }

    private async getWebsite(api: string): Promise<string> {
        try {
            const response = await axios.get(api, { headers: this.headers });
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

    private prepareReposPage(url: string): string {
        const query = '?q=&type=all&language=typescript&sort=stargazers';
        return url + query;
    }

    private async exportCsv() {
        const csvWriter = createCsvWriter.createObjectCsvWriter({
            path: ORGANIZATION_LIST_PATH,
            header: [
                { id: 'name', title: 'name' },
                { id: 'github', title: 'github search' },
                { id: 'website', title: 'website' },
                { id: 'review.score', title: 'review score' },
                { id: 'review.hiring', title: 'hiring (remote)' },
                { id: 'review.complexity', title: 'complexity' },
                { id: 'review.issues', title: 'issues' },
                { id: 'review.atCore', title: 'at the core' },
                { id: 'review.hiringProcess', title: 'hiring process' },
                { id: 'review.large', title: 'large' },
                { id: 'fetchedAt', title: 'fetched at date' },
            ],
            append: true
        });

        await csvWriter.writeRecords(this.newDf);
        console.log(`CSV file ${ORGANIZATION_LIST_PATH} written successfully.`);
    }
}
