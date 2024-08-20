from flask import Flask, render_template, request,jsonify
from googleapiclient.errors import HttpError
from googleapiclient.discovery import build
from bs4 import BeautifulSoup
import json, requests, re
import os
from yt_dlp import YoutubeDL
from flask import jsonify


app = Flask(__name__)

DEVELOPER_KEY = 'AIzaSyD7KgygEbYsJgDiPKLca2TmFffoJuqdScY' 
YOUTUBE_API_SERVICE_NAME = 'youtube'
YOUTUBE_API_VERSION = 'v3'

@app.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        username = request.form.get('username')
        if username:
            try:
                playlist_data = get_playlist_info(username)
                return render_template('home.html', username=username, playlists=playlist_data, error=None)
            except ValueError as ve:
                return render_template('home.html', username=username, playlists=None, error=str(ve))
        else:
            return render_template('home.html', username=None, playlists=None, error="Username not provided.")
    else:
        return render_template('home.html', username=None, playlists=None, error=None)

def get_playlist_info(channel_name):
    base_url = f'https://www.youtube.com/@{channel_name}/playlists'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    response = requests.get(base_url, headers=headers)

    if response.status_code == 200:
        soup = BeautifulSoup(response.content, 'html.parser')
        scripts = soup.find_all('script')

        playlists_info = []
        seen_ids = set()

        for script in scripts:
            if 'playlistId' in script.text:
                playlist_data = re.findall(r'"playlistId":"([A-Za-z0-9_-]+)"', script.text)
                if playlist_data:
                    for playlist_id in playlist_data:
                        if playlist_id not in seen_ids:
                            playlist_title = get_playlist_title(playlist_id)
                            if playlist_title:
                                playlists_info.append({'id': playlist_id, 'title': playlist_title})
                                seen_ids.add(playlist_id)
                            else:
                                print(f"Failed to fetch title for Playlist ID: {playlist_id}")
        
        return playlists_info

    else:
        raise ValueError("Failed to retrieve playlists.")

def get_playlist_title(playlist_id):
    base_url = f'https://www.youtube.com/playlist?list={playlist_id}'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    response = requests.get(base_url, headers=headers)

    if response.status_code == 200:
        soup = BeautifulSoup(response.content, 'html.parser')
        scripts = soup.find_all('script')

        for script in scripts:
            if 'ytInitialData' in script.text:
                json_text_match = re.search(r'var ytInitialData = ({.*?});', script.text, re.DOTALL)
                if json_text_match:
                    json_text = json_text_match.group(1)
                    try:
                        initial_data = json.loads(json_text)
                        title = initial_data['metadata']['playlistMetadataRenderer']['title']
                        return title
                    except (KeyError, json.JSONDecodeError) as e:
                        print(f"Failed to parse JSON or find title: {e}")
                        return None
        print("No initial data found.")
        return None

    else:
        print("Failed to retrieve webpage.")
        return None

def fetch_youtube_playlist_items(playlist_id):
    youtube = build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION, developerKey=DEVELOPER_KEY)
    playlist_items = []
    next_page_token = None

    while True:
        request = youtube.playlistItems().list(
            part='snippet',
            playlistId=playlist_id,
            maxResults=50,
            pageToken=next_page_token
        )
        response = request.execute()
        playlist_items.extend(response['items'])
        next_page_token = response.get('nextPageToken')
        if not next_page_token:
            break

    videos = []

    for item in playlist_items:
        video_id = item['snippet']['resourceId']['videoId']
        title = item['snippet']['title']
        thumbnails = item['snippet']['thumbnails']
        
        # Check for 'high' resolution thumbnail, otherwise use a default or available resolution
        if 'high' in thumbnails:
            thumbnail_url = thumbnails['high']['url']
        else:
            thumbnail_url = 'https://via.placeholder.com/480x360?text=No+Thumbnail'
        
        audio_url = f"/audio/{video_id}"

        videos.append({
            'title': title,
            'audio_url': audio_url,
            'thumbnail_url': thumbnail_url
        })

    return videos

def fetch_playlist_title(playlist_id):
    # Use the YouTube API to fetch the playlist title based on playlist_id
    youtube = build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION, developerKey=DEVELOPER_KEY)
    request = youtube.playlists().list(
        part='snippet',
        id=playlist_id
    )
    response = request.execute()
    return response['items'][0]['snippet']['title']

@app.route('/playlist', methods=['GET'])
def playlist():
    # Get the 'playlist_id' parameter from the URL query string
    playlist_id = request.args.get('playlist_id')
    
    # If 'playlist_id' is not provided, render the index page with an error message
    if not playlist_id:
        return render_template('home.html', error='Playlist ID is required.')
    
    try:
        # Fetch the videos in the playlist using a helper function
        videos = fetch_youtube_playlist_items(playlist_id)
        
        # Fetch the playlist title using the playlist_id
        playlist_title = fetch_playlist_title(playlist_id)
        
        # Render the 'playlist.html' template, passing the list of videos to the template
        return render_template('playlist.html', videos=videos, playlist_title=playlist_title)
    
    # Catch HttpError exceptions, which can occur during API calls
    except HttpError as e:
        # Render the index page with an error message if an HttpError occurs
        return render_template('home.html', error=f"An error occurred: {e}")

@app.route('/audio/<video_id>', methods=['GET'])
def audio(video_id):
    try:
        yt_url = f'https://www.youtube.com/watch?v={video_id}'
        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/best',  # Only download audio
            'quiet': True,  # Suppress console output
            'noplaylist': True,  # Do not download playlists
        }

        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(yt_url, download=False)
            audio_url = info['url']

            response = requests.head(audio_url, allow_redirects=True)
            
            if response.status_code == 200:
                return jsonify({'audio_url': audio_url})
            else:
                return jsonify({'error': 'Audio URL is not reachable'}, status=404)
    
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}, status=500)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
