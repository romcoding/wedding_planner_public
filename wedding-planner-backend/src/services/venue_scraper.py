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
        Scrape venue information from a URL.
        Returns a dictionary with extracted venue data.
        """
        try:
            # Basic headers to avoid blocking
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract basic information
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
            
            return venue_data
            
        except requests.RequestException as e:
            print(f"Error fetching URL {url}: {str(e)}")
            return {'error': f'Failed to fetch URL: {str(e)}'}
        except Exception as e:
            print(f"Error scraping venue data: {str(e)}")
            return {'error': f'Error scraping data: {str(e)}'}
    
    @staticmethod
    def _extract_name(soup, url):
        """Extract venue name from page"""
        # Try various selectors
        selectors = [
            'h1',
            '.venue-name',
            '[class*="name"]',
            'title'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                name = element.get_text(strip=True)
                if name and len(name) < 200:
                    return name
        
        # Fallback: use domain name
        try:
            from urllib.parse import urlparse
            domain = urlparse(url).netloc
            return domain.replace('www.', '').split('.')[0].title()
        except:
            return 'Venue'
    
    @staticmethod
    def _extract_description(soup):
        """Extract venue description"""
        # Try meta description first
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            return meta_desc['content'][:500]
        
        # Try common description selectors
        selectors = [
            '.description',
            '[class*="description"]',
            '.about',
            'p'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                desc = element.get_text(strip=True)
                if desc and len(desc) > 50:
                    return desc[:500]
        
        return None
    
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
        Enhance scraped data using LLM (OpenAI ChatGPT API).
        Requires OPENAI_API_KEY environment variable.
        """
        api_key = api_key or os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            return venue_data  # Return original data if no API key
        
        try:
            import openai
            
            # Prepare prompt
            prompt = f"""
            Extract and enhance wedding venue information from the following URL: {url}
            
            Current extracted data:
            {json.dumps(venue_data, indent=2)}
            
            Please provide a JSON response with enhanced information including:
            - name: Full venue name
            - description: Detailed description (2-3 sentences)
            - location: Full address if available
            - capacity: Maximum guest capacity (number only)
            - price_range: Price range in format like "$5,000-$10,000" or "Budget/Premium"
            - style: Venue style (Rustic, Modern, Classic, etc.)
            - amenities: Array of amenities
            - contact_email: Contact email
            - contact_phone: Contact phone
            - rating: Rating out of 5.0 if available
            
            Return only valid JSON, no additional text.
            """
            
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",  # or "gpt-3.5-turbo" for cheaper option
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that extracts wedding venue information. Always return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
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
            
            # Merge with original data (LLM data takes precedence)
            venue_data.update(enhanced_data)
            
            return venue_data
            
        except ImportError:
            print("OpenAI library not installed. Install with: pip install openai")
            return venue_data
        except Exception as e:
            print(f"Error enhancing with LLM: {str(e)}")
            return venue_data  # Return original data on error

