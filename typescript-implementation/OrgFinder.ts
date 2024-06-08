import axios from 'axios';
import { createReadStream, promises as fs } from 'fs';
import * as createCsvWriter from 'csv-writer';
import * as createCsvReader from 'csv-parser';
import * as path from 'path';

export class OrgFinder {
    private token: string | undefined;
    private headers: any;
    private organizations: any[];
    private newDf: any[];
    private stateFilePath: string;

    constructor() {
        this.token = process.env.GITHUB_TOKEN;
        this.headers = { 'Accept': 'application/vnd.github.v3+json' };
        if (this.token) {
            this.headers['Authorization'] = `token ${this.token}`;
        }
        this.organizations = [];
        this.newDf = [];
        this.stateFilePath = path.resolve(__dirname, 'state.json');
    }

    async append(topic: string, pagesCount: number = 5, csvName: string = 'organizations_list.csv') {
        const state = await this.loadState();
        const startPage = state.startPage || 1;
        const lastPage = state.lastPage || 1;

        await this.searchOrganizationsByCriteria(topic, startPage, lastPage);
        await this.populateTable();
        await this.exportCsv(csvName);
        await this.saveState(topic, lastPage);
    }

    private async loadState() {
        try {
            const data = await fs.readFile(this.stateFilePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading state file:', error);
            return { startPage: 1, lastPage: 1, topic: "" };
        }
    }

    private async saveState(topic: string, lastPage: number) {
        const state = { topic, lastPage };
        await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2));
    }

    private async searchOrganizationsByCriteria(topic: string, startPage: number, lastPage: number) {
        const baseUrl = 'https://api.github.com/search/repositories';
        const existingOrgs = await this.loadExistingOrganizations();

        for (let page = startPage; page <= lastPage; page++) {
            const params = {
                q: `topic:${topic}`,
                per_page: 100,
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
    }

    private async loadExistingOrganizations(): Promise<string[]> {
        const orgs: string[] = [];
        try {
            const csvFilePath = path.resolve(__dirname, 'file.csv');
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
        const df = this.organizations;
        await this.processDf(df);
    }

    private async processDf(df: any[]) {
        const now = new Date().toISOString();
        this.newDf = df.map(item => ({
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

    private async exportCsv(csvName: string) {
        const csvWriter = createCsvWriter.createObjectCsvWriter({
            path: csvName,
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
        console.log(`CSV file ${csvName} written successfully.`);
    }
}
