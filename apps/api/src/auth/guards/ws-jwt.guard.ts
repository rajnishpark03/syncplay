import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthService } from '../auth.service';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    deviceId: string;
    /** Filled in by the gateway right after auth, from the Device row. */
    deviceName?: string;
    /** Set once the device explicitly `room:join`s a room; absent otherwise. */
    roomCode?: string;
  };
}

/**
 * Validates the JWT passed in the Socket.IO handshake (`auth.token`) and
 * attaches the account/device identity to the socket. Gateways call this
 * from `handleConnection` rather than using a guard decorator, since a
 * failed auth needs to disconnect the socket rather than throw an HTTP-style
 * exception.
 */
@Injectable()
export class WsAuthService {
  private readonly logger = new Logger(WsAuthService.name);

  constructor(private readonly authService: AuthService) {}

  authenticate(socket: Socket): AuthenticatedSocket | null {
    const token = (socket.handshake.auth?.token as string) || this.extractFromHeader(socket);
    if (!token) {
      this.logger.warn(`Socket ${socket.id} connected without a token`);
      return null;
    }
    try {
      const claims = this.authService.verifyAccessToken(token);
      (socket as AuthenticatedSocket).data = {
        userId: claims.sub,
        email: claims.email,
        deviceId: claims.deviceId,
      };
      return socket as AuthenticatedSocket;
    } catch {
      this.logger.warn(`Socket ${socket.id} sent an invalid/expired token`);
      return null;
    }
  }

  private extractFromHeader(socket: Socket): string | null {
    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
    return null;
  }
}
