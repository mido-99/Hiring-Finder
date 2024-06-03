import requests
from dotenv import get_variable
from time import sleep
import pandas as pd


def search_organizations_by_criteria(token=None, min_followers=100, max_followers=5000, languages=None, per_page=100, start_page=1, max_pages=1):

    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    
    organizations = []
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
            
            response = requests.get(base_url, headers=headers, params=params)
            if response.status_code == 200:
                data = response.json()
                organizations.extend(data.get('items', []))
                print(f"Found total of {data['total_count']} organizations in {language} search")
                # Stop if fewer results than the per_page value were returned
                if len(data.get('items', [])) < per_page:
                    break
            else:
                print(f"Error: {response.status_code} - {response.json()}")
                response.raise_for_status()
    
    return organizations

def populate_table(organizations, token=None):
    
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    df = pd.DataFrame(organizations)
    processed_df = process_df(df=df, token=token)
    export_csv(processed_df)
    return processed_df
    
def process_df(df, token=None):
    # Select wanted fields only
    new_df = df[['login', 'html_url', 'url']]
    # Rename to relevant names
    new_df.rename(columns={'login': 'name', 'html_url': 'github', 'url': 'api'}, inplace=True)
    # Add website in blog 
    new_df['website'] = new_df['api'].apply(lambda x: get_website(x, token))
    # Prepare direct github link to wanted repos
    new_df['github'] = new_df['github'].apply(lambda x: prepare_repos_page(x))
    
    return new_df

def get_website(api, token=None):
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    
    resp = requests.get(api, headers=headers).json()
    site = resp['blog']
    return site
    
def prepare_repos_page(url):
    query = "?q=&type=all&language=typescript&sort=stargazers"
    return url + query
    
def export_csv(df: pd.DataFrame):
    df.to_csv('Organizations_v2.csv', index=False)

# Define criteria
languages = ['typescript']
min_followers = 100
max_followers = 5000
per_page = 15
start_page = 1
max_pages = 1
TOKEN = get_variable('.env', 'GITHUB_TOKEN')

# Search for organizations
organizations = search_organizations_by_criteria(
    token=TOKEN, min_followers=min_followers, max_followers=max_followers, 
    languages=languages, per_page=per_page, max_pages=max_pages)
populate_table(organizations, token=TOKEN)

print(f"Total organizations found: {len(organizations)}")