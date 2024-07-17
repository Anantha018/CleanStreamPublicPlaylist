document.addEventListener('DOMContentLoaded', function () {
    const playButtons = document.querySelectorAll('.play-audio');
    const searchInput = document.getElementById('searchInput');
    let currentSound = null;
    let loopSameSong = false; // Flag to control looping of the same song

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // Function to handle filtering of playlist items based on search input
    function filterPlaylists(searchTerm) {
        playButtons.forEach(button => {
            const videoTitle = button.dataset.title.toLowerCase();
            const parentLi = button.closest('li');

            if (searchTerm === '' || videoTitle.includes(searchTerm)) {
                parentLi.style.display = 'flex'; // Show matching videos or all if searchTerm is empty
            } else {
                parentLi.style.display = 'none'; // Hide non-matching videos
            }
        });
    }

    // Event listener for input in the search field
    searchInput.addEventListener('input', function () {
        const searchTerm = searchInput.value.trim().toLowerCase();
        filterPlaylists(searchTerm);
    });

    // Function to play audio
    function playAudio(audioUrl, title) {
        if (currentSound) {
            currentSound.unload();
        }

        fetch(`/audio/${audioUrl.split('/').pop()}`)
            .then(response => response.json())
            .then(data => {
                if (data.audio_url) {
                    currentSound = new Howl({
                        src: [data.audio_url],
                        html5: true,
                        autoplay: !isIOS,
                        onplay: function() {
                            updatePlayPauseButton(true);
                        },
                        onpause: function() {
                            updatePlayPauseButton(false);
                        },
                        onend: function() {
                            if (loopSameSong) {
                                currentSound.play();
                            } else {
                                playNext();
                            }
                        },
                        onloaderror: function() {
                            console.error('Error loading audio');
                            playNext();
                        }
                    });

                    const audioPlayer = document.createElement('div');
                    audioPlayer.classList.add('audioPlayer', 'active');
                    audioPlayer.innerHTML = `
                        <h2>${title}</h2>
                        <div class="audio-controls">
                            <button class="prev-btn"><i class="fas fa-step-backward"></i></button>
                            <button class="play-btn"><i class="fas fa-${isIOS ? 'play' : 'pause'}"></i></button>
                            <button class="next-btn"><i class="fas fa-step-forward"></i></button>
                            <button class="loop-btn" id="loop-toggle-btn"><i class="fas fa-redo-alt"></i></button>
                        </div>
                    `;
                    const audioPlayerContainer = document.getElementById('audioPlayer');
                    audioPlayerContainer.innerHTML = '';
                    audioPlayerContainer.appendChild(audioPlayer);

                    const prevButton = audioPlayer.querySelector('.prev-btn');
                    prevButton.addEventListener('click', playPrevious);

                    const playPauseButton = audioPlayer.querySelector('.play-btn');
                    playPauseButton.addEventListener('click', togglePlayPause);

                    const nextButton = audioPlayer.querySelector('.next-btn');
                    nextButton.addEventListener('click', playNext);

                    const loopButton = audioPlayer.querySelector('.loop-btn');
                    loopButton.addEventListener('click', toggleLoopSameSong);

                    // Update playButtons to reflect current playing state
                    playButtons.forEach(btn => btn.classList.remove('playing'));
                    const currentButton = Array.from(playButtons).find(btn => btn.dataset.audioUrl === audioUrl);
                    if (currentButton) {
                        currentButton.classList.add('playing');
                    }

                    if (isIOS) {
                        console.log('Audio ready on iOS, waiting for user interaction');
                    }
                } else {
                    console.error('No audio URL found');
                    playNext();
                }
            })
            .catch(error => {
                console.error('Error fetching audio:', error);
                playNext();
            });
    }

    // Function to update play/pause button
    function updatePlayPauseButton(isPlaying) {
        const playPauseButton = document.querySelector('.play-btn');
        if (playPauseButton) {
            playPauseButton.innerHTML = `<i class="fas fa-${isPlaying ? 'pause' : 'play'}"></i>`;
        }
    }

    // Function to toggle play/pause
    function togglePlayPause() {
        if (currentSound) {
            if (currentSound.playing()) {
                currentSound.pause();
            } else {
                currentSound.play();
            }
        }
    }

    // Function to play previous song
    function playPrevious() {
        const currentIndex = Array.from(playButtons).findIndex(button => button.classList.contains('playing'));
        let prevIndex = currentIndex - 1;

        if (prevIndex < 0) {
            prevIndex = playButtons.length - 1;
        }

        if (loopSameSong && currentSound) {
            currentSound.stop();
            currentSound.play();
        } else {
            const prevButton = playButtons[prevIndex];
            prevButton.classList.add('playing');
            playButtons[currentIndex].classList.remove('playing');
            playAudio(prevButton.dataset.audioUrl, prevButton.dataset.title);
        }
    }

    // Function to play next song
    function playNext() {
        const currentIndex = Array.from(playButtons).findIndex(button => button.classList.contains('playing'));
        let nextIndex = currentIndex + 1;

        if (nextIndex >= playButtons.length) {
            nextIndex = 0;
        }

        if (loopSameSong && currentSound) {
            currentSound.stop();
            currentSound.play();
        } else {
            const nextButton = playButtons[nextIndex];
            nextButton.classList.add('playing');
            playButtons[currentIndex].classList.remove('playing');
            playAudio(nextButton.dataset.audioUrl, nextButton.dataset.title);
        }
    }

    // Function to toggle loopSameSong flag
    function toggleLoopSameSong() {
        loopSameSong = !loopSameSong; // Toggle the flag
        const loopButton = document.querySelector('.loop-btn');
        loopButton.classList.toggle('active', loopSameSong); // Toggle active class based on loopSameSong flag
    }

    // Attach click event listeners to playButtons
    playButtons.forEach(button => {
        button.addEventListener('click', function (event) {
            event.preventDefault();
            playButtons.forEach(btn => btn.classList.remove('playing'));
            button.classList.add('playing');
            playAudio(button.dataset.audioUrl, button.dataset.title);
        });
    });

    // Automatically play the first song if available (except on iOS)
    if (!isIOS && playButtons.length > 0) {
        const firstButton = playButtons[0];
        if (firstButton.dataset.audioUrl) {
            firstButton.classList.add('playing');
            playAudio(firstButton.dataset.audioUrl, firstButton.dataset.title);
        }
    }

    const container = document.querySelector('.container');
    const audioPlayer = document.getElementById('audioPlayer');

    // Toggle active class on audioPlayer based on scroll position
    window.addEventListener('scroll', function() {
        const rect = container.getBoundingClientRect();
        audioPlayer.classList.toggle('active', rect.top <= 0);
    });
})
