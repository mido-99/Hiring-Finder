import requests
import httpx
import asyncio
from dotenv import get_variable
from time import sleep
import pandas as pd


class OrgFinder:
    
    def __init__(self, token=None) -> None:
        self.token = token
        self.set_headers()

    def hire(self, languages: list=None, per_page=100, start_page=1, last_page=1, csv_name: str='file.csv'):
        """Search github organizations' profiles by specific criteria \n
        Parameters:
        - Param languages(list[str]): main language used by that user
        - Param per_page(int - def: 100): number of results per search (def: 30, max: 100)
        - Param start_page(int - def: 1): page number to start from (used if you stopped last time in a certain page)
        - Param max_page(int - def: 1): number of searches to do after the first page (min: 1)
        \n
        This method uses github api primary rate limit (50 req/hour), If an authentication token 
        was given; increases to 5000 req/hour. \n
        Final requests made = be max_page - start_page \n
        You can always check status of limit in the headers returned with each response; like:
        - x-ratelimit-remaining: The number of requests remaining in the current rate limit window
        \n 
        Read more at: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#checking-the-status-of-your-rate-limit
        """

        self.search_organizations_by_criteria(languages, per_page, start_page, last_page)
        self.populate_table()
        self.export_csv(csv_name)
        
    def set_headers(self):
        """Sets headers for github REST API requests
        """
        
        self.headers = {"Accept": "application/vnd.github.v3+json"}
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"

    def search_organizations_by_criteria(self, languages: list=None, per_page=100, start_page=1, last_page=1):

        self.organizations = []
        base_url = "https://api.github.com/search/users"
        for language in languages:
            query = f"type:org language:{language}"
            for page in range(start_page, last_page+1):
                params = {
                    'q': query,
                    'per_page': per_page,
                    'page': page
                }
                sleep(1)
                
                response = requests.get(base_url, headers=self.headers, params=params)
                if response.status_code == 200:
                    data = response.json()
                    self.organizations.extend(data.get('items', []))
                    print(f"Found total of {data['total_count']} organizations in {language} search")
                    # Stop if fewer results than the per_page value were returned
                    if len(data.get('items', [])) < per_page:
                        break
                else:
                    print(f"Error in request to page: {page}: {response.status_code} - {response.json()}")
    
    async def populate_table(self):
        
        df = pd.DataFrame(self.organizations)
        await self.process_df(df=df)
        
    async def process_df(self, df):
        # Select wanted fields only
        self.new_df = df[['login', 'html_url', 'url']].copy()
        # Rename to relevant names
        self.new_df.rename(columns={'login': 'name', 'html_url': 'github', 'url': 'api'}, inplace=True)
        # Add website in blog 
        self.new_df['website'] = await self.async_fetch_site(self.new_df['api'].to_list())
        # Prepare direct github link to wanted repos
        self.new_df['github'] = self.new_df['github'].apply(lambda x: self.prepare_repos_page(x))
        
    async def async_fetch_site(self, apis: list):
        
        async with httpx.AsyncClient(headers=self.headers) as client:
            tasks = [self.get_website(client, api) for api in apis]
            websites = await asyncio.gather(*tasks)
        return websites

    async def get_website(self, client, api):
        
        resp = await client.get(api)
        if resp.status_code == 200:
            data = resp.json()
            return data.get('blog', [])
        else:
            print(f"Eroor fetching blog site with {api}")
            return ""
        
    def prepare_repos_page(self, url):
        query = "?q=&type=all&language=typescript&sort=stargazers"
        return url + query
        
    def export_csv(self, csv_name):
        self.new_df.to_csv(f'{csv_name}', index=False, columns=['name', 'github', 'website'])


if __name__ == "__main__":
    TOKEN = get_variable('.env', 'GITHUB_TOKEN')
    languages = ['typescript']
    per_page = 100
    start_page = 2
    last_page = 3

    hiring = OrgFinder(token=TOKEN)
    hiring.hire(languages=languages, per_page=per_page, 
                start_page=start_page, last_page=last_page, csv_name='orgs_2_5.csv')