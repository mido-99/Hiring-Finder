import requests
from dotenv import get_variable
from time import sleep
import pandas as pd


class OrgFinder:
    
    def __init__(self, token=None) -> None:
        self.token = token
        self.set_headers()

    def hire(self, min_followers=100, max_followers=5000, languages: list=None, per_page=100, start_page=1, max_pages=1, csv_name: str='file.csv'):
        """Search github organizations' profiles by specific criteria \n
        Parameters:
        - Param min_followers(int - def: 100): minimum numbers of followers for organization to include
        - Param max_followers(int - def: 5000): maximum numbers of followers for organization to include
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

        self.search_organizations_by_criteria(min_followers, max_followers, languages, per_page, start_page, max_pages)
        self.populate_table()
        self.export_csv(csv_name)
        
    def set_headers(self):
        """Sets headers for github REST API requests
        """
        
        self.headers = {"Accept": "application/vnd.github.v3+json"}
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"

    def search_organizations_by_criteria(self, min_followers=100, max_followers=5000, languages: list=None, per_page=100, start_page=1, max_pages=1):

        self.organizations = []
        base_url = "https://api.github.com/search/users"
        for language in languages:
            query = f"type:org followers:{min_followers}..{max_followers} language:{language}"
            for page in range(start_page, start_page+max_pages):
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
    
    def populate_table(self):
        
        df = pd.DataFrame(self.organizations)
        self.process_df(df=df)
        
    def process_df(self, df):
        # Select wanted fields only
        self.new_df = df[['login', 'html_url', 'url']]
        # Rename to relevant names
        self.new_df.rename(columns={'login': 'name', 'html_url': 'github', 'url': 'api'}, inplace=True)
        # Add website in blog 
        self.new_df['website'] = self.new_df['api'].apply(lambda x: self.get_website(x))
        # Prepare direct github link to wanted repos
        self.new_df['github'] = self.new_df['github'].apply(lambda x: self.prepare_repos_page(x))

    def get_website(self, api):
        
        resp = requests.get(api, headers=self.headers).json()
        site = resp['blog']
        return site
        
    def prepare_repos_page(self, url):
        query = "?q=&type=all&language=typescript&sort=stargazers"
        return url + query
        
    def export_csv(self, csv_name):
        self.new_df.to_csv(f'{csv_name}', index=False, columns=['name', 'github', 'website'])


if __name__ == "__main__":
    TOKEN = get_variable('.env', 'GITHUB_TOKEN')
    languages = ['typescript']
    min_followers = 100
    max_followers = 5000
    per_page = 100
    start_page = 1
    max_pages = 1

    hiring = OrgFinder(token=TOKEN)
    hiring.hire(min_followers=min_followers, max_followers=max_followers, languages=languages,
                per_page=per_page, start_page=start_page, max_pages=max_pages, csv_name='orgs3.csv')