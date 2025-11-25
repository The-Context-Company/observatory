declare global {
  namespace NodeJS {
    interface Process {
      _tccWss?: WebSocketServer;
      _tccServer?: Server;
    }
  }
}

export {};
