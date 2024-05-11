# webrtc-sandbox

WebRTC remote p2p testing

## STUN/TURN server

```shell
apt install coturn

code /etc/turnserver.conf
```

```conf
listening-port=3478
external-ip=外网ip
user=用户名密码
```

```shell
sudo service coturn restart
```

或者直接启动看输出

```shell
turnserver -v
```

如果报端口被占用，查看端口占用

```shell
lsof -i :3478
```
