declare global {
  namespace NodeJS {
    interface Process {
      _tccWss?: WebSocketServer;
      _tccWssToken?: string;
      _tccServer?: Server;
    }
  }
}

export {};
