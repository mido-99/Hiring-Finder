import axios from 'axios';
import { promises as fs } from 'fs';
import * as dotenv from 'dotenv';
import * as createCsvWriter from 'csv-writer';

dotenv.config();

class OrgFinder {
    private token: string | undefined;
    private headers: any;
    private organizations: any[];
    private newDf: any[];

    constructor(token?: string) {
        this.token = token;
        this.headers = { 'Accept': 'application/vnd.github.v3+json' };
        if (this.token) {
            this.headers['Authorization'] = `token ${this.token}`;
        }
        this.organizations = [];
        this.newDf = [];
    }

    async hire(languages: string[], perPage = 100, startPage = 1, lastPage = 1, csvName: string = 'file.csv') {
        await this.searchOrganizationsByCriteria(languages, perPage, startPage, lastPage);
        await this.populateTable();
        await this.exportCsv(csvName);
    }

    private async searchOrganizationsByCriteria(languages: string[], perPage: number, startPage: number, lastPage: number) {
        const baseUrl = 'https://api.github.com/search/users';

        for (const language of languages) {
            const query = `type:org language:${language}`;

            for (let page = startPage; page <= lastPage; page++) {
                const params = {
                    q: query,
                    per_page: perPage,
                    page: page,
                };

                await new Promise(resolve => setTimeout(resolve, 1000));

                try {
                    const response = await axios.get(baseUrl, { headers: this.headers, params: params });
                    if (response.status === 200) {
                        const data = response.data;
                        this.organizations.push(...data.items);
                        console.log(`Found total of ${data.total_count} organizations in ${language} search`);
                        if (data.items.length < perPage) {
                            break;
                        }
                    } else {
                        console.error(`Error in request to page: ${page}: ${response.status} - ${response.data}`);
                    }
                } catch (error) {
                    console.error(`Error in request to page: ${page}: ${error}`);
                }
            }
        }
    }

    private async populateTable() {
        const df = this.organizations;
        await this.processDf(df);
    }

    private async processDf(df: any[]) {
        this.newDf = df.map(item => ({
            name: item.login,
            github: this.prepareReposPage(item.html_url),
            api: item.url,
            website: ''
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
                { id: 'github', title: 'github' },
                { id: 'website', title: 'website' },
            ],
        });

        await csvWriter.writeRecords(this.newDf);
        console.log(`CSV file ${csvName} written successfully.`);
    }
}

(async () => {
    const TOKEN = process.env.GITHUB_TOKEN;
    const languages = ['typescript'];
    const perPage = 100;
    const startPage = 2;
    const lastPage = 3;

    const hiring = new OrgFinder(TOKEN);
    await hiring.hire(languages, perPage, startPage, lastPage, 'orgs_2_5.csv');
})();
