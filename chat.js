let peerConnection = new RTCPeerConnection();
let dataChannel = null;

document.getElementById('createOffer').onclick = async () => {
    dataChannel = peerConnection.createDataChannel("chatChannel");
    setupDataChannel();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Display the offer to be copied
    document.getElementById('localDescription').value = JSON.stringify(offer);
};

document.getElementById('createAnswer').onclick = async () => {
    const offer = JSON.parse(document.getElementById('localDescription').value);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    if (!dataChannel) {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel();
        };
    }

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Display the answer to be copied
    document.getElementById('localDescription').value = JSON.stringify(answer);
};

document.getElementById('localDescription').oninput = async () => {
    const input = JSON.parse(document.getElementById('localDescription').value);

    if (input.type && (input.type === 'answer' || input.type === 'offer')) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(input));
    }
};

document.getElementById('sendMessage').onclick = () => {
    const message = document.getElementById('message').value;
    dataChannel.send(message);

    // Append message to chat
    const chatBox = document.getElementById('chat');
    chatBox.value += 'Me: ' + message + '\n';
    document.getElementById('message').value = ''; // Clear input field
};

function setupDataChannel() {
    dataChannel.onmessage = (event) => {
        // Append received message to chat
        const chatBox = document.getElementById('chat');
        chatBox.value += 'Peer: ' + event.data + '\n';
    };

    dataChannel.onopen = () => console.log("Data channel opened.");
    dataChannel.onclose = () => console.log("Data channel closed.");
}

peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        console.log("New ICE candidate:", event.candidate);
    }
};