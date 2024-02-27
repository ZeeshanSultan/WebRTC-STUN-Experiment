let peerConnection = new RTCPeerConnection();
let dataChannel = null;
let isInitiator = false;
let localNickname = '';
let sharedKey = null;

// Elements for showing/hiding
const connectionElements = document.getElementById('connectionElements');
const chatElements = document.getElementById('chatElements');

// Import encryption Key
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64); // Decode base64
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

async function importKey(keyBuffer) {
    return await window.crypto.subtle.importKey(
        "raw", // format
        keyBuffer, // key in ArrayBuffer format
        { // Algorithm the key will be used with
            name: "AES-GCM",
        },
        false, // whether the key is extractable (i.e., can be used in exportKey)
        ["encrypt", "decrypt"] // what operations the key can be used for
    );
}

async function setupEncryptionKey() {
    const aesKeyBase64 = document.getElementById('aesKey').value.trim();
    if (!aesKeyBase64) {
        console.error('No AES key provided.');
        return;
    }

    const keyBuffer = base64ToArrayBuffer(aesKeyBase64);
    try {
        sharedKey = await importKey(keyBuffer);
        console.log('Key imported successfully:', sharedKey);
        return sharedKey; // This is the key you'll use for encryption/decryption
    } catch (error) {
        console.error('Key import failed:', error);
    }
}


// Encryption Block
async function encryptMessage(key, data) {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // AES-GCM IV

    const encryptedData = await window.crypto.subtle.encrypt({
            name: "AES-GCM",
            iv: iv,
        },
        key,
        encodedData
    );

    // Convert encrypted data to base64 and iv to a string for sending
    const encryptedDataB64 = btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
    const ivB64 = btoa(String.fromCharCode(...iv));
    return { encryptedData: encryptedDataB64, iv: ivB64 };
}

// Decryption Block
async function decryptMessage(key, encryptedDataB64, ivB64) {
    const encryptedData = Uint8Array.from(atob(encryptedDataB64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));

    const decryptedData = await window.crypto.subtle.decrypt({
            name: "AES-GCM",
            iv: iv,
        },
        key,
        encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
}

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
        document.getElementById('nicknameDiv').style.display = 'none';
    }
    if (document.getElementById('aesKey').value.trim() !== '') {
        document.getElementById('aesKeyDiv').style.display = 'none';
    }
};

document.getElementById('connect').onclick = async() => {
    if (document.getElementById('aesKey').value.trim() == '') {
        updateInstructions("AES Key is required for encryption. Please enter a valid key.");
        return;
    }
    const encodedConnectionInfo = document.getElementById('connectionInfo').value;
    const decodedConnectionInfo = atob(encodedConnectionInfo);
    const connectionInfo = JSON.parse(decodedConnectionInfo);
    console.log("Attempting to connect...");
    updateInstructions("Attempting to connect. Please wait...");

    await setupEncryptionKey();

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
        document.getElementById('nicknameDiv').style.display = 'none';
    }
    if (document.getElementById('aesKey').value.trim() !== '') {
        document.getElementById('aesKeyDiv').style.display = 'none';
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
    dataChannel.onmessage = async(event) => {
        const { encryptedData, iv } = JSON.parse(event.data);
        const decryptedMessage = await decryptMessage(sharedKey, encryptedData, iv);
        const messageData = JSON.parse(decryptedMessage);

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

async function sendMessage() {
    const message = document.getElementById('message').value;
    localNickname = document.getElementById('nickname').value || 'Anonymous'; // Get or default to 'Anonymous'
    if (message === '') return; // Prevent sending empty messages

    const messageData = {
        message: message,
        nickname: localNickname,
        timestamp: new Date() // Use the current date/time for the timestamp
    };

    const encrypted = await encryptMessage(sharedKey, JSON.stringify(messageData));
    dataChannel.send(JSON.stringify(encrypted)); // Send encrypted data and iv

    const formattedTime = moment(messageData.timestamp).fromNow();
    document.getElementById('chat').value += `[${formattedTime}] You: ${messageData.message}\n`;
    document.getElementById('message').value = ''; // Clear the input after sending
}

function updateInstructions(message) {
    document.getElementById('instructions').innerText = message;
}

document.getElementById('connectionInfo').onpaste = async() => {
    document.getElementById("initiateConnection").style.display = 'none';
}