import * as dotenv from 'dotenv';
import { OrgFinder } from './OrgFinder';

dotenv.config();

const TOPIC = 'typescript';

(async () => {
    const orgFinder = new OrgFinder();
    await orgFinder.append(TOPIC);
})();
