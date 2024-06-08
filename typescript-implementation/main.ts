import * as dotenv from 'dotenv';
import { OrgFinder } from './OrgFinder';

dotenv.config();

const FILE_NAME = 'organization_list.csv';
const TOPIC = 'typescript';

(async () => {
    const orgFinder = new OrgFinder();
    await orgFinder.append(TOPIC, 5, FILE_NAME);
})();
