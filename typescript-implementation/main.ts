import * as dotenv from 'dotenv';
import { OrgFinder } from './OrgFinder';

dotenv.config();

const FILE_NAME = 'organization_list.csv';
const TOPICS = ['typescript'];
const ORGANIZATIONS_PER_PAGE = 10;
const START_PAGE = 1;
const LAST_PAGE = 1;

(async () => {
    const hiring = new OrgFinder(process.env.GITHUB_TOKEN);
    await hiring.hire(TOPICS, ORGANIZATIONS_PER_PAGE, START_PAGE, LAST_PAGE, FILE_NAME);
})();
