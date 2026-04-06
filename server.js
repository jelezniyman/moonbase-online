const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Раздаем статические файлы из папки public
app.use(express.static('public'));

const players = {};

io.on('connection', (socket) => {
    console.log('Новый игрок подключился:', socket.id);

    // Обработка входа в игру
    socket.on('joinGame', (playerData) => {
        players[socket.id] = { id: socket.id, ...playerData };
        // Отправляем новичку список всех, кто уже в игре
        socket.emit('currentPlayers', players);
        // Оповещаем остальных о новичке
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // Обработка движения
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id] = { ...players[socket.id], ...movementData };
            // Рассылаем новые координаты всем остальным
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Обработка выстрела
    socket.on('shoot', (projectileData) => {
        socket.broadcast.emit('newProjectile', projectileData);
    });

    // Чат
    socket.on('chatMessage', (msgData) => {
        io.emit('chatMessage', msgData); // Отправляем всем
    });

    // Отключение
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});