import axios from 'axios';
import { promises as fs } from 'fs';
import { createReadStream, existsSync } from 'fs';
import * as path from 'path';
import createCsvReader from 'csv-parser';

const REPOS_PER_PAGE = 100;
const ORGANIZATION_LIST_PATH = 'organizations_list.csv';

export class OrganizationSearcher {
    private token: string | undefined;
    private headers: any;
    private organizations: any[] = [];

    constructor() {
        this.token = process.env.GITHUB_TOKEN;
        this.headers = { 'Accept': 'application/vnd.github.v3+json' };
        if (this.token) {
            this.headers['Authorization'] = `token ${this.token}`;
        }
    }

    async searchOrganizationsByCriteria(topic: string, page: number) {
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
                const newOrgs = this.filterNewOrganizationList(data, existingOrgs);
                this.organizations.push(...newOrgs);
                console.log(`Found total of ${data.total_count} repositories for topic ${topic}`);
            } else {
                console.error(`Error in request to page: ${page}: ${response.status} - ${response.data}`);
            }
        } catch (error) {
            console.error(`Error in request to page: ${page}: ${error}`);
        }
    }

    private filterNewOrganizationList(data: any, existingOrgs: string[]) {
        const newOrgsSet = new Set<string>();

        data.items.forEach((item: any) => {
            const ownerLogin = item.owner.login;
            if (!existingOrgs.includes(ownerLogin)) {
                newOrgsSet.add(ownerLogin);
            }
        });

        return Array.from(newOrgsSet);
    }

    async loadExistingOrganizations(): Promise<string[]> {
        const orgs: string[] = [];
        const csvFilePath = path.resolve(__dirname, ORGANIZATION_LIST_PATH);

        try {
            if (!existsSync(csvFilePath)) {
                await fs.writeFile(csvFilePath, '');
            }

            const stream = createReadStream(csvFilePath).pipe(createCsvReader({ headers: ['name'] }));

            await new Promise<void>((resolve, reject) => {
                stream.on('data', (row: any) => {
                    if (row && row.name) {
                        orgs.push(row.name);
                    }
                });

                stream.on('end', resolve);
                stream.on('error', reject);
            });
        } catch (error) {
            console.error(`Error loading existing organizations from file ${csvFilePath}:`, error);
        }

        return orgs;
    }

    getOrganizations() {
        return this.organizations;
    }
}
