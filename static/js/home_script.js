function disableButton() {
    var submitBtn = document.getElementById('submitBtn');
    var loadingMessage = document.getElementById('loadingMessage');
    submitBtn.disabled = true;
    loadingMessage.classList.add('active');
}

function enableButton() {
    var submitBtn = document.getElementById('submitBtn');
    var loadingMessage = document.getElementById('loadingMessage');
    submitBtn.disabled = false;
    loadingMessage.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', function() {
    var form = document.querySelector('form');
    form.addEventListener('submit', disableButton);

    // Enable button on page load if playlists are present
    var playlists = document.querySelectorAll('ul li');
    if (playlists.length > 0) {
        enableButton();
    }
});
