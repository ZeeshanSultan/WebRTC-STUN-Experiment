let peerConnection = new RTCPeerConnection();
let dataChannel = null;
let isInitiator = false;
let localNickname = '';

// Elements for showing/hiding
const connectionElements = document.getElementById('connectionElements');
const chatElements = document.getElementById('chatElements');

document.getElementById('initiateConnection').onclick = async() => {
    isInitiator = true;
    console.log("You are the initiator. Generating an offer...");
    updateInstructions("Generating an offer. Please wait...");

    dataChannel = peerConnection.createDataChannel("chatChannel");
    setupDataChannel();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await gatherComplete(peerConnection);
    // Encode offer to Base64 and display in the div
    const base64Offer = btoa(JSON.stringify(peerConnection.localDescription));
    document.getElementById('encodedOffer').innerText = base64Offer;

    console.log("Offer generated and encoded. Please copy it to your peer.");
    updateInstructions("Copy the encoded connection info and send it to the other user.");

    // Hide the "Initiate Connection" button
    document.getElementById('initiateConnection').style.display = 'none';
    if (document.getElementById('nickname').value.trim() !== '') {
        document.getElementById('nickname').style.display = 'none';
    }
};

document.getElementById('connect').onclick = async() => {
    const encodedConnectionInfo = document.getElementById('connectionInfo').value;
    const decodedConnectionInfo = atob(encodedConnectionInfo);
    const connectionInfo = JSON.parse(decodedConnectionInfo);
    console.log("Attempting to connect...");
    updateInstructions("Attempting to connect. Please wait...");

    if (!isInitiator) {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel();
        };
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(connectionInfo));

    if (!isInitiator) {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await gatherComplete(peerConnection);
        const base64Answer = btoa(JSON.stringify(peerConnection.localDescription));
        document.getElementById('encodedAnswer').innerText = base64Answer;
    }

    // Hide both "Initiate Connection" and "Connect" buttons
    document.getElementById('initiateConnection').style.display = 'none';
    document.getElementById('connect').style.display = 'none';
    document.getElementById('connectionInfo').style.display = 'none';
    console.log("Waiting for connection...");

    //Hide nickname field if filled
    if (document.getElementById('nickname').value.trim() !== '') {
        document.getElementById('nickname').style.display = 'none';
    }

    // Update instructions with additional information
    console.log("Answer generated and encoded. Please copy it back to the initiator.");
    updateInstructions("Copy the encoded connection info and send it back to the initiator. Ask them to press 'Connect' once pasted.");
};


peerConnection.onconnectionstatechange = () => {
    switch (peerConnection.connectionState) {
        case 'connected':
            console.log("Peers connected. You can start chatting now.");
            updateInstructions("Connection established. Start chatting!");
            connectionElements.style.display = 'none';
            chatElements.style.display = 'block';
            break;
        case 'disconnected':
        case 'failed':
            console.log("Connection failed or disconnected.");
            updateInstructions("Connection failed or disconnected. Please reconnect.");
            connectionElements.style.display = 'block';
            chatElements.style.display = 'none';
            break;
    }
};

async function gatherComplete(pc) {
    if (pc.iceGatheringState === 'complete') {
        return;
    }

    await new Promise((resolve) => {
        const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
                pc.removeEventListener('icegatheringstatechange', checkState);
                resolve();
            }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
    });
}

// Setup data channel and add event listeners for the data channel
function setupDataChannel() {
    dataChannel.onopen = () => console.log("Data channel opened.");
    dataChannel.onclose = () => console.log("Data channel closed.");
    dataChannel.onmessage = (event) => {
        const messageData = JSON.parse(event.data);
        const formattedTime = moment(messageData.timestamp).fromNow();
        document.getElementById('chat').value += `[${formattedTime}] ${messageData.nickname}: ${messageData.message}\n`;
    };
}

document.getElementById('sendMessage').onclick = () => {
    sendMessage();
};

// Handle Enter key press in the message input field
document.getElementById('message').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent the default action to stop from adding a newline
        sendMessage();
    }
});

function sendMessage() {
    const message = document.getElementById('message').value;
    localNickname = document.getElementById('nickname').value || 'Anonymous'; // Get or default to 'Anonymous'
    if (message === '') return; // Prevent sending empty messages

    const messageData = {
        message: message,
        nickname: localNickname,
        timestamp: new Date() // Use the current date/time for the timestamp
    };

    dataChannel.send(JSON.stringify(messageData)); // Send stringified message data
    const formattedTime = moment(messageData.timestamp).fromNow();
    document.getElementById('chat').value += `[${formattedTime}] You: ${messageData.message}\n`;
    document.getElementById('message').value = ''; // Clear the input after sending
}

function updateInstructions(message) {
    document.getElementById('instructions').innerText = message;
}