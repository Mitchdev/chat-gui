interface WhisperMessage {
  id: string;
  userid: string;
  targetuserid: string;
  message: string;
  timestamp: string;
  isread: string;
  deletedbysender: string;
  deletedbyreceiver: string;
  from: string;
  to: string;
}

export default WhisperMessage;
