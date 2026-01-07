"""
Service for scraping venue information from URLs
Supports both basic web scraping and LLM-enhanced extraction
"""
import os
import requests
from bs4 import BeautifulSoup
import json
import re

class VenueScraperService:
    """Service for extracting venue information from URLs"""
    
    @staticmethod
    def scrape_venue_from_url(url):
        """
        Scrape venue information from a URL with improved precision and validation.
        Returns a dictionary with extracted venue data. Only includes validated, high-quality data.
        """
        try:
            # Validate URL format
            if not url or not url.startswith(('http://', 'https://')):
                return {'error': 'Invalid URL format. Please provide a valid http:// or https:// URL.'}
            
            # Basic headers to avoid blocking
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            }
            
            # Fetch with timeout and error handling
            try:
                response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
                response.raise_for_status()
            except requests.exceptions.Timeout:
                return {'error': 'Request timed out. The website took too long to respond.'}
            except requests.exceptions.ConnectionError:
                return {'error': 'Connection error. Could not reach the website. Please check the URL.'}
            except requests.exceptions.HTTPError as e:
                return {'error': f'HTTP error {e.response.status_code}: Could not access the website.'}
            
            # Parse HTML
            try:
                soup = BeautifulSoup(response.content, 'html.parser')
            except Exception as e:
                return {'error': f'Failed to parse webpage content: {str(e)}'}
            
            # Extract basic information with validation
            venue_data = {
                'name': VenueScraperService._extract_name(soup, url),
                'description': VenueScraperService._extract_description(soup),
                'location': VenueScraperService._extract_location(soup),
                'capacity': VenueScraperService._extract_capacity(soup),
                'price_range': VenueScraperService._extract_price_range(soup),
                'style': VenueScraperService._extract_style(soup),
                'amenities': VenueScraperService._extract_amenities(soup),
                'contact_email': VenueScraperService._extract_email(soup),
                'contact_phone': VenueScraperService._extract_phone(soup),
                'website': url,
                'rating': VenueScraperService._extract_rating(soup),
            }
            
            # Validate and clean data - remove None/empty values that might be false positives
            validated_data = {}
            for key, value in venue_data.items():
                if value is not None and value != '' and value != []:
                    # Additional validation for specific fields
                    if key == 'name' and len(str(value)) > 200:
                        continue  # Skip if name is too long (likely wrong)
                    if key == 'description' and len(str(value)) < 20:
                        continue  # Skip if description is too short (likely wrong)
                    if key == 'capacity' and (not isinstance(value, int) or value < 1 or value > 100000):
                        continue  # Skip invalid capacity
                    if key == 'rating' and (not isinstance(value, (int, float)) or value < 0 or value > 5):
                        continue  # Skip invalid rating
                    validated_data[key] = value
            
            # Always include website
            validated_data['website'] = url
            
            return validated_data
            
        except requests.RequestException as e:
            error_msg = str(e)
            if 'timeout' in error_msg.lower():
                return {'error': 'Request timed out. The website took too long to respond.'}
            elif 'connection' in error_msg.lower():
                return {'error': 'Connection error. Could not reach the website. Please check the URL.'}
            else:
                return {'error': f'Failed to fetch URL: {error_msg}'}
        except Exception as e:
            print(f"Error scraping venue data: {str(e)}")
            return {'error': f'Error scraping data: {str(e)}'}
    
    @staticmethod
    def _extract_name(soup, url):
        """Extract venue name from page with improved precision"""
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
        
        # Try various selectors in order of reliability
        selectors = [
            'h1',  # Most common for page title
            '[class*="venue"][class*="name"]',
            '[class*="title"]',
            '.venue-name',
            '[class*="name"]',
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                name = element.get_text(strip=True)
                # Validate name quality
                if name and 3 <= len(name) <= 150 and not name.lower().startswith(('home', 'menu', 'contact', 'about')):
                    # Remove common unwanted prefixes
                    name = re.sub(r'^(home|menu|contact|about)\s*[-:]?\s*', '', name, flags=re.IGNORECASE).strip()
                    if name:
                        return name
        
        # Try title tag as fallback
        title_tag = soup.find('title')
        if title_tag:
            title = title_tag.get_text(strip=True)
            # Clean title (remove site name, separators)
            title = re.sub(r'\s*[-|]\s*.*$', '', title)  # Remove everything after - or |
            title = re.sub(r'\s*-\s*.*$', '', title)  # Remove site name
            if title and 3 <= len(title) <= 150:
                return title
        
        # Last resort: use domain name
        try:
            from urllib.parse import urlparse
            domain = urlparse(url).netloc
            domain_name = domain.replace('www.', '').split('.')[0]
            if domain_name and len(domain_name) > 2:
                return domain_name.title()
        except:
            pass
        
        return None  # Return None instead of generic 'Venue' to indicate missing data
    
    @staticmethod
    def _extract_description(soup):
        """Extract venue description with improved precision"""
        # Remove unwanted elements
        for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
            script.decompose()
        
        # Try meta description first (usually most accurate)
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            desc = meta_desc['content'].strip()
            if desc and 30 <= len(desc) <= 1000:
                return desc
        
        # Try Open Graph description
        og_desc = soup.find('meta', attrs={'property': 'og:description'})
        if og_desc and og_desc.get('content'):
            desc = og_desc['content'].strip()
            if desc and 30 <= len(desc) <= 1000:
                return desc
        
        # Try common description selectors (prioritize more specific ones)
        selectors = [
            '[class*="description"]',
            '[class*="about"]',
            '[class*="intro"]',
            'main p',
            'article p',
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            for element in elements[:3]:  # Check first 3 matches
                desc = element.get_text(strip=True)
                # Validate description quality
                if desc and 50 <= len(desc) <= 1000:
                    # Skip if it looks like navigation or menu
                    if not any(word in desc.lower() for word in ['home', 'menu', 'login', 'sign up', 'cookie']):
                        return desc[:500]
        
        return None  # Better to return None than low-quality data
    
    @staticmethod
    def _extract_location(soup):
        """Extract location/address"""
        # Look for address patterns
        address_patterns = [
            r'\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)',
            r'[A-Z][a-z]+,\s*[A-Z]{2}\s+\d{5}',
        ]
        
        text = soup.get_text()
        for pattern in address_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0)
        
        # Try common location selectors
        selectors = [
            '.address',
            '[class*="address"]',
            '.location',
            '[class*="location"]',
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                location = element.get_text(strip=True)
                if location:
                    return location[:200]
        
        return None
    
    @staticmethod
    def _extract_capacity(soup):
        """Extract capacity number"""
        text = soup.get_text()
        
        # Look for capacity patterns
        patterns = [
            r'capacity[:\s]+(\d+)',
            r'(\d+)\s+guests?',
            r'(\d+)\s+people',
            r'seats?\s+(\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return int(match.group(1))
                except:
                    pass
        
        return None
    
    @staticmethod
    def _extract_price_range(soup):
        """Extract price range"""
        text = soup.get_text()
        
        # Look for price patterns
        patterns = [
            r'\$[\d,]+[\s-]+?\$[\d,]+',
            r'(\$[\d,]+)\s*-\s*(\$[\d,]+)',
            r'from\s+\$?(\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)[:50]
        
        return None
    
    @staticmethod
    def _extract_style(soup):
        """Extract venue style"""
        text = soup.get_text().lower()
        
        styles = ['rustic', 'modern', 'classic', 'elegant', 'beach', 'garden', 'industrial', 'barn', 'vintage']
        
        for style in styles:
            if style in text:
                return style.capitalize()
        
        return None
    
    @staticmethod
    def _extract_amenities(soup):
        """Extract amenities list"""
        amenities = []
        text = soup.get_text().lower()
        
        common_amenities = [
            'parking', 'catering', 'bar', 'dance floor', 'outdoor space',
            'bridal suite', 'sound system', 'lighting', 'wifi', 'air conditioning',
            'heating', 'restrooms', 'accessibility', 'photography', 'videography'
        ]
        
        for amenity in common_amenities:
            if amenity in text:
                amenities.append(amenity.title())
        
        return amenities if amenities else None
    
    @staticmethod
    def _extract_email(soup):
        """Extract email address"""
        text = soup.get_text()
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        match = re.search(email_pattern, text)
        if match:
            return match.group(0)
        
        # Try mailto links
        mailto = soup.find('a', href=re.compile(r'^mailto:'))
        if mailto:
            return mailto['href'].replace('mailto:', '')
        
        return None
    
    @staticmethod
    def _extract_phone(soup):
        """Extract phone number"""
        text = soup.get_text()
        
        # Common phone patterns
        patterns = [
            r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
            r'\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0)
        
        # Try tel links
        tel = soup.find('a', href=re.compile(r'^tel:'))
        if tel:
            return tel['href'].replace('tel:', '')
        
        return None
    
    @staticmethod
    def _extract_rating(soup):
        """Extract rating if available"""
        # Look for rating patterns (e.g., 4.5 stars, 4/5)
        text = soup.get_text()
        
        patterns = [
            r'(\d+\.?\d*)\s*stars?',
            r'rating[:\s]+(\d+\.?\d*)',
            r'(\d+\.?\d*)\s*/\s*5',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    rating = float(match.group(1))
                    if 0 <= rating <= 5:
                        return rating
                except:
                    pass
        
        return None
    
    @staticmethod
    def enhance_with_llm(venue_data, url, api_key=None):
        """
        Enhance scraped data using LLM (OpenAI ChatGPT API) with strict validation.
        Only includes high-quality, validated information. Better to have missing data than false data.
        """
        api_key = api_key or os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            return venue_data  # Return original data if no API key
        
        try:
            import openai
            
            # Fetch page content for LLM analysis
            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
                response = requests.get(url, headers=headers, timeout=15)
                response.raise_for_status()
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Remove unwanted elements
                for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
                    script.decompose()
                
                # Get clean text (limit to avoid token limits)
                page_text = soup.get_text()[:5000]  # Limit to first 5000 chars
            except:
                page_text = "Unable to fetch page content"
            
            # Prepare precise prompt with validation requirements
            prompt = f"""
            Analyze the following wedding venue website and extract ONLY accurate, verified information.
            URL: {url}
            
            Current scraped data (may contain errors):
            {json.dumps(venue_data, indent=2)}
            
            Page content excerpt:
            {page_text[:2000]}
            
            Extract and return ONLY information that you are confident is accurate. If you are unsure about any field, omit it (return null).
            
            Return a JSON object with these fields (only include fields you are certain about):
            - name: Exact venue name (string, max 150 chars)
            - description: Accurate description (string, 50-500 chars, must be factual)
            - location: Full address if clearly stated (string, max 200 chars)
            - capacity: Maximum guest capacity ONLY if explicitly stated (integer, 1-100000)
            - price_range: Price range ONLY if clearly stated (string, format: "$X,XXX-$X,XXX" or "Budget/Mid-range/Premium")
            - style: Venue style ONLY if clearly indicated (one of: Rustic, Modern, Classic, Elegant, Beach, Garden, Industrial, Barn, Vintage)
            - amenities: Array of amenities ONLY if explicitly mentioned (array of strings)
            - contact_email: Email address if found (string, must be valid email format)
            - contact_phone: Phone number if found (string, must be valid phone format)
            - rating: Rating ONLY if from a review system (float, 0.0-5.0)
            
            IMPORTANT RULES:
            1. Only include data you are CERTAIN is accurate
            2. Do NOT guess or infer information
            3. Do NOT include generic or placeholder text
            4. If a field is uncertain, omit it (return null)
            5. Validate all data types and formats
            6. Return ONLY valid JSON, no markdown, no explanations
            
            Return format (example):
            {{
              "name": "Venue Name",
              "description": "Accurate description...",
              "location": "Full address",
              "capacity": 200,
              "price_range": "$5,000-$10,000",
              "style": "Elegant",
              "amenities": ["Parking", "Catering"],
              "contact_email": "info@venue.com",
              "contact_phone": "+1 234 567 8900",
              "rating": 4.5
            }}
            """
            
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a precise data extraction assistant. You ONLY return verified, accurate information. If uncertain, omit the field. Always return valid JSON only, no markdown, no explanations."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Lower temperature for more deterministic, accurate responses
                max_tokens=1000
            )
            
            # Parse LLM response
            llm_text = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks if present
            if llm_text.startswith('```'):
                llm_text = llm_text.split('```')[1]
                if llm_text.startswith('json'):
                    llm_text = llm_text[4:]
                llm_text = llm_text.strip()
            
            enhanced_data = json.loads(llm_text)
            
            # Validate and merge data (only include validated fields)
            validated_enhanced = {}
            for key, value in enhanced_data.items():
                if value is not None and value != '':
                    # Additional validation
                    if key == 'name' and isinstance(value, str) and 3 <= len(value) <= 150:
                        validated_enhanced[key] = value
                    elif key == 'description' and isinstance(value, str) and 50 <= len(value) <= 1000:
                        validated_enhanced[key] = value
                    elif key == 'location' and isinstance(value, str) and len(value) <= 200:
                        validated_enhanced[key] = value
                    elif key == 'capacity' and isinstance(value, int) and 1 <= value <= 100000:
                        validated_enhanced[key] = value
                    elif key == 'price_range' and isinstance(value, str) and len(value) <= 100:
                        validated_enhanced[key] = value
                    elif key == 'style' and value in ['Rustic', 'Modern', 'Classic', 'Elegant', 'Beach', 'Garden', 'Industrial', 'Barn', 'Vintage']:
                        validated_enhanced[key] = value
                    elif key == 'amenities' and isinstance(value, list):
                        validated_enhanced[key] = value
                    elif key == 'contact_email' and isinstance(value, str) and '@' in value and '.' in value:
                        validated_enhanced[key] = value
                    elif key == 'contact_phone' and isinstance(value, str) and len(value) >= 7:
                        validated_enhanced[key] = value
                    elif key == 'rating' and isinstance(value, (int, float)) and 0 <= value <= 5:
                        validated_enhanced[key] = float(value)
            
            # Merge: LLM data takes precedence, but keep original website
            venue_data.update(validated_enhanced)
            venue_data['website'] = url  # Always keep original URL
            
            return venue_data
            
        except ImportError:
            print("OpenAI library not installed. Install with: pip install openai")
            return venue_data
        except json.JSONDecodeError as e:
            print(f"LLM returned invalid JSON: {str(e)}")
            return venue_data  # Return original data on JSON error
        except Exception as e:
            print(f"Error enhancing with LLM: {str(e)}")
            return venue_data  # Return original data on error

