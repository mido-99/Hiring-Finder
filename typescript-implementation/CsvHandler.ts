import * as createCsvWriter from 'csv-writer';

const ORGANIZATION_LIST_PATH = 'organizations_list.csv';

export class CsvHandler {
    private newDf: any[] = [];

    setNewDataFrame(newDf: any[]) {
        this.newDf = newDf;
    }

    async exportCsv() {
        const csvWriter = createCsvWriter.createObjectCsvWriter({
            path: ORGANIZATION_LIST_PATH,
            header: [
                { id: 'name', title: 'name' },
                { id: 'github', title: 'github search' },
                { id: 'website', title: 'website' },
                { id: 'score', title: 'review score' },
                { id: 'hiring', title: 'hiring (remote)' },
                { id: 'complexity', title: 'complexity' },
                { id: 'issues', title: 'issues' },
                { id: 'atCore', title: 'at the core' },
                { id: 'hiringProcess', title: 'hiring process' },
                { id: 'large', title: 'large' },
                { id: 'fetchedAt', title: 'fetched at date' },
            ],
            append: true
        });

        await csvWriter.writeRecords(this.newDf);
        console.log(`CSV file ${ORGANIZATION_LIST_PATH} written successfully.`);
    }
}
