import requests
import pandas as pd
from time import sleep
from curl_cffi import requests as curl_requests
from bs4 import BeautifulSoup
import re
from dotenv import get_variable


def search_repositories_by_topic(topic, token=None, start_page=1, per_page=100, max_pages=1):
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    
    organizations = []
    for page in range(start_page, start_page+max_pages):
        params = {
            'q': f'topic:{topic}',
            'per_page': per_page,
            'page': page
        }
        sleep(1)
        response = requests.get("https://api.github.com/search/repositories", headers=headers, params=params)
        if response.status_code == 200:
            repos_data = response.json()
            page_orgs = extract_organizations_from_repos(repos_data)
            organizations.extend(page_orgs)
            print(f'Parsing page {page}...')

            # If results less thtn `per_page` stop
            if len(repos_data.get('items', [])) < per_page:
                break
        else:
            break
    
    return organizations

def extract_organizations_from_repos(repos_data):
    organizations = set()
    for repo in repos_data.get('items', []):
        owner = repo['owner']
        if owner['type'] == 'Organization':
            organizations.add((owner['login'], owner['url'], owner['html_url']))
    
    possible = []
    for org in organizations:
        possible_org = extract_organization_blog_link(org[1])
        if possible_org:
            possible.append([org[0], org[2]])
        
    return possible

def extract_organization_blog_link(api_url):
    response = requests.get(api_url)
    if response.status_code == 200:
        org_data = response.json()
        org_link = org_data.get('blog', [])
        if org_link:
            print(org_link)
            org_link = check_url_integrity(org_link)
            if has_career(org_link):
                return org_data.get('html_url', [])
    return None

def check_url_integrity(url):
    if not url.startswith('https://') and not url.startswith('http://'):
        url = "https://" + url
    return url

def has_career(org_link, token=None):    
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
        
    r = curl_requests.get(org_link, impersonate='chrome116', headers=headers)
    soup = BeautifulSoup(r.text, 'html.parser')
    pattern = re.compile(r'career|job|Hiring|Join us')
    links = soup.find_all('a', href=pattern)
    if links != []:
        return True
    return None    

def export_csv(organizations):
    df = pd.DataFrame(organizations, columns=['Organization', 'Github'])
    df.to_csv('Organizations.csv', index=False)

topic = "typescript"
TOKEN = get_variable('.env', 'GITHUB_TOKEN')


organizations = search_repositories_by_topic(topic, token=TOKEN, max_pages=1, start_page=1)
export_csv(organizations)

# print(f"Organizations using topic '{topic}':")
# for num, org in enumerate(organizations):
#     print(f"{num}: ", org)
print(f"Fetched {len(organizations)} Organizations.")