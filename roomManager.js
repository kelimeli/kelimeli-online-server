const crypto = require("crypto");

const FIXED_RULES = Object.freeze({ wordCount: 5, durationSec: 200 });
const FIXED_ROOMS = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `PUBLIC-${i + 1}`, type: "public", name: `Online Oda ${i + 1}`, maxPlayers: 4 })),
  ...Array.from({ length: 40 }, (_, i) => ({ id: `DUEL-${i + 1}`, type: "duel", name: `Birebir Oda ${i + 1}`, maxPlayers: 2 }))
];

const PRIVATE_WORD_COUNTS = new Set([3, 5, 7, 10]);
const PRIVATE_DURATIONS = new Set([90, 120, 150, 200, 240, 300]);

class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function normalizePrivateSettings(input = {}) {
  const wordCount = Number(input.wordCount ?? 5);
  const durationSec = Number(input.durationSec ?? 200);
  if (!PRIVATE_WORD_COUNTS.has(wordCount)) {
    throw new RoomError("INVALID_WORD_COUNT", "Kelime sayısı 3, 5, 7 veya 10 olabilir.");
  }
  if (!PRIVATE_DURATIONS.has(durationSec)) {
    throw new RoomError("INVALID_DURATION", "Kelime süresi 90, 120, 150, 200, 240 veya 300 saniye olabilir.");
  }
  return { wordCount, durationSec };
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.playerRoom = new Map();
    for (const def of FIXED_ROOMS) {
      this.rooms.set(def.id, this.makeRoom({
        ...def,
        fixed: true,
        code: null,
        settings: { ...FIXED_RULES }
      }));
    }
  }

  makeRoom({ id, code, type, name, maxPlayers, fixed, settings }) {
    return {
      id,
      code,
      type,
      name,
      maxPlayers,
      fixed,
      settings: { ...settings },
      status: "waiting",
      hostPlayerId: null,
      createdAt: new Date().toISOString(),
      countdownEndsAt: null,
      match: null,
      players: new Map()
    };
  }

  normalizeRoomId(roomId) {
    return String(roomId || "").trim().toUpperCase();
  }

  makePrivateCode() {
    for (let i = 0; i < 1000; i += 1) {
      const code = String(crypto.randomInt(100000, 1000000));
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError("CODE_GENERATION_FAILED", "Yeni oda kodu üretilemedi.");
  }

  playerRecord(player) {
    return {
      id: player.id,
      name: player.name,
      socketId: player.socketId,
      connected: true,
      ready: false,
      joinedAt: new Date().toISOString()
    };
  }

  listFixedRooms() {
    return FIXED_ROOMS.map(({ id }) => this.serializeRoom(this.rooms.get(id)));
  }

  getRoom(roomId) {
    return this.rooms.get(this.normalizeRoomId(roomId)) || null;
  }

  getPlayerRoomId(playerId) {
    return this.playerRoom.get(playerId) || null;
  }

  getPlayerRoom(playerId) {
    const id = this.playerRoom.get(playerId);
    return id ? this.rooms.get(id) || null : null;
  }

  createPrivateRoom(player, maxPlayers = 4, settingsInput = {}) {
    const size = Number(maxPlayers);
    if (![2, 3, 4].includes(size)) {
      throw new RoomError("INVALID_ROOM_SIZE", "Özel oda 2, 3 veya 4 kişilik olabilir.");
    }
    const settings = normalizePrivateSettings(settingsInput);

    this.leaveRoom(player.id);
    const code = this.makePrivateCode();
    const room = this.makeRoom({
      id: code,
      code,
      type: "private",
      name: "Özel Oda",
      maxPlayers: size,
      fixed: false,
      settings
    });

    room.hostPlayerId = player.id;
    room.players.set(player.id, this.playerRecord(player));
    this.playerRoom.set(player.id, room.id);
    this.rooms.set(room.id, room);
    return room;
  }

  findBestRoom(type) {
    const candidates = [...this.rooms.values()].filter(room =>
      room.type === type &&
      room.fixed &&
      room.players.size < room.maxPlayers &&
      ["waiting", "countdown"].includes(room.status)
    );
    candidates.sort((a, b) => {
      if (b.players.size !== a.players.size) return b.players.size - a.players.size;
      return a.id.localeCompare(b.id);
    });
    return candidates[0] || null;
  }

  quickJoin(type, player) {
    if (!["duel", "public"].includes(type)) {
      throw new RoomError("INVALID_MATCHMAKING_TYPE", "Geçersiz eşleştirme türü.");
    }
    const room = this.findBestRoom(type);
    if (!room) {
      throw new RoomError("NO_ROOM_AVAILABLE", type === "duel" ? "Şu an uygun birebir odası yok." : "Şu an uygun çoklu oda yok.");
    }
    return this.joinRoom(room.id, player);
  }

  joinRoom(roomId, player) {
    const id = this.normalizeRoomId(roomId);
    const room = this.rooms.get(id);
    if (!room) throw new RoomError("ROOM_NOT_FOUND", "Oda bulunamadı.");

    const existingRoomId = this.playerRoom.get(player.id);
    if (existingRoomId === room.id && room.players.has(player.id)) {
      const existing = room.players.get(player.id);
      existing.socketId = player.socketId;
      existing.connected = true;
      existing.name = player.name;
      return room;
    }

    const canJoinCountdown = room.fixed && room.status === "countdown";
    if (room.status !== "waiting" && !canJoinCountdown) {
      throw new RoomError("ROOM_IN_MATCH", "Bu odada karşılaşma devam ediyor.");
    }
    if (room.players.size >= room.maxPlayers) {
      throw new RoomError("ROOM_FULL", "Bu oda dolu.");
    }

    if (existingRoomId) this.leaveRoom(player.id);
    if (!room.hostPlayerId) room.hostPlayerId = player.id;

    room.players.set(player.id, this.playerRecord(player));
    this.playerRoom.set(player.id, room.id);
    return room;
  }

  leaveRoom(playerId) {
    const roomId = this.playerRoom.get(playerId);
    if (!roomId) return { room: null, deleted: false };

    const room = this.rooms.get(roomId);
    this.playerRoom.delete(playerId);
    if (!room) return { room: null, deleted: false };

    room.players.delete(playerId);

    if (room.hostPlayerId === playerId) {
      const nextHost = [...room.players.values()]
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
      room.hostPlayerId = nextHost?.id || null;
    }

    if (!room.fixed && room.players.size === 0) {
      this.rooms.delete(room.id);
      return { room, deleted: true };
    }

    if (room.fixed && room.players.size === 0) {
      room.status = "waiting";
      room.countdownEndsAt = null;
      room.match = null;
      room.hostPlayerId = null;
    }

    return { room, deleted: false };
  }

  setReady(playerId, ready) {
    const room = this.getPlayerRoom(playerId);
    if (!room) throw new RoomError("NOT_IN_ROOM", "Önce bir odaya katılmalısın.");
    if (!["waiting", "countdown"].includes(room.status)) {
      throw new RoomError("MATCH_ALREADY_STARTED", "Karşılaşma başladı.");
    }

    const player = room.players.get(playerId);
    if (!player) throw new RoomError("NOT_IN_ROOM", "Oyuncu odada bulunamadı.");

    player.ready = Boolean(ready);
    return room;
  }

  markDisconnected(playerId) {
    const room = this.getPlayerRoom(playerId);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;

    player.connected = false;
    player.socketId = null;
    if (!["playing", "round-results"].includes(room.status)) player.ready = false;
    return room;
  }

  reconnectPlayer(player) {
    const room = this.getPlayerRoom(player.id);
    if (!room) return null;
    const record = room.players.get(player.id);
    if (!record) {
      this.playerRoom.delete(player.id);
      return null;
    }

    record.socketId = player.socketId;
    record.connected = true;
    record.name = player.name;
    return room;
  }

  isDisconnected(playerId) {
    const room = this.getPlayerRoom(playerId);
    const player = room?.players.get(playerId);
    return Boolean(player && !player.connected);
  }

  connectedPlayers(room) {
    return [...room.players.values()].filter(p => p.connected);
  }

  readyPlayers(room) {
    return this.connectedPlayers(room).filter(p => p.ready);
  }

  resetToWaiting(room) {
    if (!room) return;
    room.status = "waiting";
    room.countdownEndsAt = null;
    room.match = null;
    for (const player of room.players.values()) player.ready = false;
  }

  serializeRoom(room) {
    if (!room) return null;

    const progressById = new Map();
    const currentRound = room.match?.currentRound;
    if (currentRound?.participants) {
      for (const p of currentRound.participants.values()) {
        progressById.set(p.id, {
          attempts: p.guesses.length,
          solved: Boolean(p.solvedAt),
          finished: Boolean(p.finishedAt),
          surrendered: Boolean(p.surrendered),
          progress: p.guesses.map(g => g.result)
        });
      }
    }

    const totalScoreById = room.match?.scores || new Map();
    const players = [...room.players.values()]
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        ready: p.ready,
        isHost: room.hostPlayerId === p.id,
        score: Number(totalScoreById.get(p.id) || 0),
        match: progressById.get(p.id) || null
      }));

    const match = room.match ? {
      id: room.match.id,
      startedAt: room.match.startedAt,
      finishedAt: room.match.finishedAt || null,
      currentRound: room.match.currentRoundNumber,
      totalRounds: room.match.totalRounds,
      roundEndsAt: room.match.currentRound?.endsAt || null,
      durationMs: room.match.durationMs,
      maxAttempts: room.match.maxAttempts,
      standings: room.match.standings || null
    } : null;

    return {
      id: room.id,
      code: room.code,
      type: room.type,
      name: room.name,
      fixed: room.fixed,
      status: room.status,
      maxPlayers: room.maxPlayers,
      playerCount: players.length,
      connectedCount: players.filter(p => p.connected).length,
      countdownEndsAt: room.countdownEndsAt,
      settings: { ...room.settings },
      players,
      match
    };
  }
}

module.exports = {
  RoomManager,
  RoomError,
  FIXED_ROOMS,
  FIXED_RULES,
  PRIVATE_WORD_COUNTS,
  PRIVATE_DURATIONS,
  normalizePrivateSettings
};
