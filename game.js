// 게임 설정
const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLANET_COUNT: 12,
    SHIP_PRODUCTION_RATE: 0.5, // 초당 생산되는 함선 수
    PLAYER_PRODUCTION_MULTIPLIER: 1.5, // 플레이어 생산 속도 부스트
    SHIP_SPEED: 100, // 픽셀/초
    PLAYER: 1,
    ENEMY: 2,
    NEUTRAL: 0,
    BOOST_COOLDOWN: 30, // 부스트 스킬 쿨다운 (초)
    BOOST_DURATION: 5, // 부스트 지속 시간 (초)
    BOOST_MULTIPLIER: 3 // 부스트 시 생산 속도 배율
};

// 행성 클래스
class Planet {
    constructor(x, y, radius, owner = CONFIG.NEUTRAL) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.owner = owner;
        // 플레이어는 100, 적은 30, 중립은 10-30
        if (owner === CONFIG.PLAYER) {
            this.ships = 100;
        } else if (owner === CONFIG.ENEMY) {
            this.ships = 30;
        } else {
            this.ships = Math.floor(Math.random() * 20 + 10);
        }
        this.productionRate = radius / 15; // 큰 행성일수록 생산 속도 빠름
    }

    produceShips(deltaTime, boostMultiplier = 1) {
        if (this.owner !== CONFIG.NEUTRAL) {
            let multiplier = this.owner === CONFIG.PLAYER ? CONFIG.PLAYER_PRODUCTION_MULTIPLIER : 1;
            this.ships += CONFIG.SHIP_PRODUCTION_RATE * this.productionRate * deltaTime * multiplier * boostMultiplier;
        }
    }

    draw(ctx, isSelected = false) {
        // 행성 그림자
        ctx.beginPath();
        ctx.arc(this.x + 3, this.y + 3, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        // 행성 본체
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        // 소유자에 따른 색상
        if (this.owner === CONFIG.PLAYER) {
            ctx.fillStyle = '#3498db';
        } else if (this.owner === CONFIG.ENEMY) {
            ctx.fillStyle = '#e74c3c';
        } else {
            ctx.fillStyle = '#7f8c8d';
        }
        ctx.fill();

        // 테두리
        ctx.strokeStyle = isSelected ? '#f1c40f' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();

        // 함선 수 표시
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.floor(this.ships), this.x, this.y);

        // 생산 속도 표시 (작은 점)
        const dots = Math.floor(this.productionRate);
        for (let i = 0; i < dots; i++) {
            ctx.beginPath();
            ctx.arc(this.x - 10 + i * 7, this.y + this.radius + 10, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
        }
    }

    contains(x, y) {
        const dx = this.x - x;
        const dy = this.y - y;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }
}

// 함선 그룹 클래스
class ShipGroup {
    constructor(from, to, ships, owner) {
        this.x = from.x;
        this.y = from.y;
        this.targetX = to.x;
        this.targetY = to.y;
        this.ships = ships;
        this.owner = owner;
        this.target = to;

        // 이동 방향 계산
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.vx = (dx / distance) * CONFIG.SHIP_SPEED;
        this.vy = (dy / distance) * CONFIG.SHIP_SPEED;
    }

    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        // 목표 도착 확인
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < 5; // 도착했으면 true
    }

    draw(ctx) {
        // 함선 그룹을 작은 삼각형들로 표시
        ctx.save();
        ctx.translate(this.x, this.y);

        const angle = Math.atan2(this.vy, this.vx);
        ctx.rotate(angle);

        const shipCount = Math.min(Math.floor(this.ships / 5), 10);
        for (let i = 0; i < shipCount; i++) {
            const offsetX = (i % 5) * 8 - 16;
            const offsetY = Math.floor(i / 5) * 8 - 4;

            ctx.beginPath();
            ctx.moveTo(offsetX + 5, offsetY);
            ctx.lineTo(offsetX - 3, offsetY - 3);
            ctx.lineTo(offsetX - 3, offsetY + 3);
            ctx.closePath();

            ctx.fillStyle = this.owner === CONFIG.PLAYER ? '#3498db' : '#e74c3c';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();

        // 함선 수 표시
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(this.ships), this.x, this.y - 15);
    }

    attack() {
        if (this.target.owner === this.owner) {
            // 아군 행성 - 함선 보충
            this.target.ships += this.ships;
        } else {
            // 적 행성 - 전투
            if (this.ships > this.target.ships) {
                // 공격 성공
                this.target.ships = this.ships - this.target.ships;
                this.target.owner = this.owner;
            } else {
                // 공격 실패
                this.target.ships -= this.ships;
            }
        }
    }
}

// 게임 클래스
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        this.planets = [];
        this.shipGroups = [];
        this.selectedPlanet = null;
        this.lastTime = 0;
        this.sendAllMode = false; // 전체 보내기 모드
        this.lastClickTime = 0;

        // 스킬 시스템
        this.boostCooldown = 0;
        this.boostActive = false;
        this.boostTimeLeft = 0;

        // 게임 상태
        this.gameOver = false;
        this.gameWon = false;
        this.combo = 0;
        this.lastConquerTime = 0;
        this.startTime = Date.now();
        this.conqueredPlanets = 0;

        this.init();
        this.setupEventListeners();
        this.gameLoop();
    }

    init() {
        // 행성 생성
        this.planets = [];
        const margin = 80;

        for (let i = 0; i < CONFIG.PLANET_COUNT; i++) {
            let x, y, radius, tooClose;
            let attempts = 0;

            do {
                x = margin + Math.random() * (CONFIG.CANVAS_WIDTH - margin * 2);
                y = margin + Math.random() * (CONFIG.CANVAS_HEIGHT - margin * 2);
                radius = 20 + Math.random() * 20;
                tooClose = false;

                // 다른 행성과 겹치지 않는지 확인
                for (let planet of this.planets) {
                    const dx = planet.x - x;
                    const dy = planet.y - y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < planet.radius + radius + 50) {
                        tooClose = true;
                        break;
                    }
                }

                attempts++;
            } while (tooClose && attempts < 100);

            if (attempts < 100) {
                let owner = CONFIG.NEUTRAL;

                // 처음 2개는 플레이어, 3번째는 적 (플레이어에게 유리)
                if (i === 0 || i === 1) owner = CONFIG.PLAYER;
                else if (i === 2) owner = CONFIG.ENEMY;

                this.planets.push(new Planet(x, y, radius, owner));
            }
        }
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => {
            if (this.gameOver) {
                this.restart();
                return;
            }

            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const currentTime = Date.now();

            // 더블클릭 감지 (300ms 이내)
            if (currentTime - this.lastClickTime < 300) {
                this.sendAllMode = !this.sendAllMode;
            }
            this.lastClickTime = currentTime;

            // 클릭한 행성 찾기
            const clickedPlanet = this.planets.find(p => p.contains(x, y));

            if (clickedPlanet) {
                if (this.selectedPlanet && this.selectedPlanet !== clickedPlanet) {
                    // 선택된 행성에서 클릭한 행성으로 공격
                    if (this.selectedPlanet.owner === CONFIG.PLAYER && this.selectedPlanet.ships >= 1) {
                        const sendRatio = this.sendAllMode ? 0.9 : 0.5; // 전체 보내기 모드면 90%
                        const shipsToSend = Math.floor(this.selectedPlanet.ships * sendRatio);
                        if (shipsToSend > 0) {
                            this.sendShips(this.selectedPlanet, clickedPlanet, shipsToSend);
                            this.selectedPlanet.ships -= shipsToSend;
                        }
                    }
                    this.selectedPlanet = null;
                } else if (clickedPlanet.owner === CONFIG.PLAYER) {
                    // 플레이어 행성 선택
                    this.selectedPlanet = clickedPlanet;
                }
            } else {
                this.selectedPlanet = null;
            }
        });

        // 스페이스바로 부스트 스킬 발동
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.boostCooldown <= 0 && !this.gameOver) {
                this.activateBoost();
                e.preventDefault();
            }
        });
    }

    sendShips(from, to, ships) {
        this.shipGroups.push(new ShipGroup(from, to, ships, from.owner));
    }

    activateBoost() {
        this.boostActive = true;
        this.boostTimeLeft = CONFIG.BOOST_DURATION;
        this.boostCooldown = CONFIG.BOOST_COOLDOWN;
    }

    restart() {
        this.planets = [];
        this.shipGroups = [];
        this.selectedPlanet = null;
        this.sendAllMode = false;
        this.boostCooldown = 0;
        this.boostActive = false;
        this.boostTimeLeft = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.combo = 0;
        this.lastConquerTime = 0;
        this.startTime = Date.now();
        this.conqueredPlanets = 0;
        this.init();
    }

    update(deltaTime) {
        if (this.gameOver) return;

        // 부스트 타이머 업데이트
        if (this.boostActive) {
            this.boostTimeLeft -= deltaTime;
            if (this.boostTimeLeft <= 0) {
                this.boostActive = false;
                this.boostTimeLeft = 0;
            }
        }
        if (this.boostCooldown > 0) {
            this.boostCooldown -= deltaTime;
        }

        // 콤보 타이머 (5초 내에 점령하지 않으면 리셋)
        if (Date.now() - this.lastConquerTime > 5000) {
            this.combo = 0;
        }

        // 행성 함선 생산
        const boostMultiplier = this.boostActive ? CONFIG.BOOST_MULTIPLIER : 1;
        for (let planet of this.planets) {
            if (planet.owner === CONFIG.PLAYER) {
                planet.produceShips(deltaTime, boostMultiplier);
            } else {
                planet.produceShips(deltaTime);
            }
        }

        // 함선 그룹 이동 및 공격
        for (let i = this.shipGroups.length - 1; i >= 0; i--) {
            const group = this.shipGroups[i];
            if (group.update(deltaTime)) {
                const oldOwner = group.target.owner;
                group.attack();

                // 행성 점령 감지 (콤보 카운트)
                if (oldOwner !== group.owner && group.target.owner === group.owner && group.owner === CONFIG.PLAYER) {
                    this.combo++;
                    this.lastConquerTime = Date.now();
                    this.conqueredPlanets++;
                }

                this.shipGroups.splice(i, 1);
            }
        }

        // AI 행동
        this.updateAI();

        // 승리/패배 조건 체크
        this.checkGameOver();

        // UI 업데이트
        this.updateUI();
    }

    updateAI() {
        if (Math.random() < 0.01) { // 1% 확률로 AI 행동 (이전 2%에서 감소)
            const enemyPlanets = this.planets.filter(p => p.owner === CONFIG.ENEMY && p.ships > 30);
            if (enemyPlanets.length === 0) return;

            const sourcePlanet = enemyPlanets[Math.floor(Math.random() * enemyPlanets.length)];

            // 타겟 선택 (중립 행성 우선, 그 다음 플레이어)
            const neutralPlanets = this.planets.filter(p => p.owner === CONFIG.NEUTRAL);
            const playerPlanets = this.planets.filter(p => p.owner === CONFIG.PLAYER);
            const targets = neutralPlanets.length > 0 ? neutralPlanets : playerPlanets;

            if (targets.length > 0) {
                // 가장 가까운 약한 타겟 찾기
                let bestTarget = null;
                let bestScore = -1;

                for (let target of targets) {
                    const dx = target.x - sourcePlanet.x;
                    const dy = target.y - sourcePlanet.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const score = (sourcePlanet.ships - target.ships) / distance;

                    // AI가 더 신중하게 공격 (2배 필요)
                    if (score > bestScore && sourcePlanet.ships > target.ships * 2) {
                        bestScore = score;
                        bestTarget = target;
                    }
                }

                if (bestTarget) {
                    const shipsToSend = Math.floor(sourcePlanet.ships * 0.5);
                    this.sendShips(sourcePlanet, bestTarget, shipsToSend);
                    sourcePlanet.ships -= shipsToSend;
                }
            }
        }
    }

    checkGameOver() {
        const playerPlanets = this.planets.filter(p => p.owner === CONFIG.PLAYER);
        const enemyPlanets = this.planets.filter(p => p.owner === CONFIG.ENEMY);

        if (enemyPlanets.length === 0) {
            this.gameOver = true;
            this.gameWon = true;
        } else if (playerPlanets.length === 0) {
            this.gameOver = true;
            this.gameWon = false;
        }
    }

    updateUI() {
        const playerPlanets = this.planets.filter(p => p.owner === CONFIG.PLAYER);
        const enemyPlanets = this.planets.filter(p => p.owner === CONFIG.ENEMY);

        const playerShips = playerPlanets.reduce((sum, p) => sum + Math.floor(p.ships), 0);
        const enemyShips = enemyPlanets.reduce((sum, p) => sum + Math.floor(p.ships), 0);

        document.getElementById('player-planets').textContent = playerPlanets.length;
        document.getElementById('player-ships').textContent = playerShips;
        document.getElementById('enemy-planets').textContent = enemyPlanets.length;
        document.getElementById('enemy-ships').textContent = enemyShips;
    }

    draw() {
        // 배경
        this.ctx.fillStyle = '#0a0a1e';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // 별 배경 (간단한 효과)
        for (let i = 0; i < 50; i++) {
            const x = (i * 137.5) % CONFIG.CANVAS_WIDTH;
            const y = (i * 217.3) % CONFIG.CANVAS_HEIGHT;
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.fillRect(x, y, 1, 1);
        }

        // 선택된 행성과 다른 행성 사이 연결선
        if (this.selectedPlanet) {
            for (let planet of this.planets) {
                if (planet !== this.selectedPlanet && planet.owner !== CONFIG.PLAYER) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.selectedPlanet.x, this.selectedPlanet.y);
                    this.ctx.lineTo(planet.x, planet.y);
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                    this.ctx.lineWidth = 1;
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                }
            }
        }

        // 행성 그리기
        for (let planet of this.planets) {
            planet.draw(this.ctx, planet === this.selectedPlanet);
        }

        // 함선 그룹 그리기
        for (let group of this.shipGroups) {
            group.draw(this.ctx);
        }

        // UI 요소 그리기
        this.drawUI();

        // 게임 오버 화면
        if (this.gameOver) {
            this.drawGameOver();
        }
    }

    drawUI() {
        const padding = 10;

        // 부스트 스킬 UI (왼쪽 상단)
        const skillX = padding;
        const skillY = padding;
        const skillSize = 60;

        this.ctx.fillStyle = this.boostCooldown > 0 ? 'rgba(100, 100, 100, 0.7)' : 'rgba(46, 204, 113, 0.7)';
        this.ctx.fillRect(skillX, skillY, skillSize, skillSize);
        this.ctx.strokeStyle = this.boostActive ? '#f1c40f' : 'white';
        this.ctx.lineWidth = this.boostActive ? 3 : 2;
        this.ctx.strokeRect(skillX, skillY, skillSize, skillSize);

        // 부스트 아이콘
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('⚡', skillX + skillSize / 2, skillY + skillSize / 2 - 5);

        // 쿨다운 표시
        if (this.boostCooldown > 0) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText(Math.ceil(this.boostCooldown), skillX + skillSize / 2, skillY + skillSize / 2 + 10);
        } else if (this.boostActive) {
            this.ctx.fillStyle = '#f1c40f';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.fillText(Math.ceil(this.boostTimeLeft) + 's', skillX + skillSize / 2, skillY + skillSize + 15);
        }

        // 스페이스바 힌트
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '10px Arial';
        this.ctx.fillText('SPACE', skillX + skillSize / 2, skillY + skillSize + 25);

        // 전체 보내기 모드 표시 (왼쪽 하단)
        if (this.sendAllMode) {
            this.ctx.fillStyle = 'rgba(241, 196, 15, 0.8)';
            this.ctx.fillRect(padding, CONFIG.CANVAS_HEIGHT - 50, 150, 40);
            this.ctx.strokeStyle = '#f1c40f';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(padding, CONFIG.CANVAS_HEIGHT - 50, 150, 40);

            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('⚔️ 전체 보내기 모드', padding + 10, CONFIG.CANVAS_HEIGHT - 25);
        }

        // 콤보 표시 (오른쪽 상단)
        if (this.combo > 1) {
            const comboX = CONFIG.CANVAS_WIDTH - padding - 100;
            const comboY = padding;

            this.ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
            this.ctx.fillRect(comboX, comboY, 100, 50);
            this.ctx.strokeStyle = '#e74c3c';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(comboX, comboY, 100, 50);

            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.combo + ' COMBO', comboX + 50, comboY + 30);
        }

        // 진행 상황 바 (상단 중앙)
        const enemyPlanets = this.planets.filter(p => p.owner === CONFIG.ENEMY);
        const totalPlanets = this.planets.length;
        const conqueredCount = totalPlanets - enemyPlanets.length - this.planets.filter(p => p.owner === CONFIG.NEUTRAL).length;

        const barWidth = 200;
        const barHeight = 25;
        const barX = CONFIG.CANVAS_WIDTH / 2 - barWidth / 2;
        const barY = padding;

        // 배경
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // 진행도
        const progress = conqueredCount / totalPlanets;
        this.ctx.fillStyle = '#3498db';
        this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);

        // 테두리
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // 텍스트
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${conqueredCount}/${totalPlanets} 행성`, barX + barWidth / 2, barY + barHeight / 2 + 4);

        // 남은 적 행성 수
        this.ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`적 행성: ${enemyPlanets.length}`, barX + barWidth / 2, barY + barHeight + 15);
    }

    drawGameOver() {
        // 반투명 오버레이
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        const centerX = CONFIG.CANVAS_WIDTH / 2;
        const centerY = CONFIG.CANVAS_HEIGHT / 2;

        if (this.gameWon) {
            // 승리 화면
            this.ctx.fillStyle = '#2ecc71';
            this.ctx.font = 'bold 60px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🎉 승리! 🎉', centerX, centerY - 80);

            // 통계
            const playTime = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(playTime / 60);
            const seconds = playTime % 60;

            this.ctx.fillStyle = 'white';
            this.ctx.font = '24px Arial';
            this.ctx.fillText(`플레이 시간: ${minutes}분 ${seconds}초`, centerX, centerY - 10);
            this.ctx.fillText(`점령한 행성: ${this.conqueredPlanets}개`, centerX, centerY + 30);
            this.ctx.fillText(`최고 콤보: ${this.combo > 0 ? this.combo : 1}`, centerX, centerY + 70);

            // 평가 메시지
            let message = '훌륭합니다!';
            if (playTime < 60) message = '⚡ 번개같은 승리!';
            else if (playTime < 120) message = '✨ 빠른 승리!';
            else if (this.combo >= 5) message = '🔥 완벽한 연속 공격!';

            this.ctx.fillStyle = '#f1c40f';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillText(message, centerX, centerY + 110);
        } else {
            // 패배 화면
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.font = 'bold 60px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('패배...', centerX, centerY - 60);

            this.ctx.fillStyle = 'white';
            this.ctx.font = '24px Arial';
            this.ctx.fillText('포기하지 마세요!', centerX, centerY);
            this.ctx.fillText(`점령한 행성: ${this.conqueredPlanets}개`, centerX, centerY + 40);
        }

        // 재시작 안내
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '20px Arial';
        this.ctx.fillText('클릭하여 다시 시작', centerX, CONFIG.CANVAS_HEIGHT - 50);
    }

    gameLoop(timestamp = 0) {
        const deltaTime = (timestamp - this.lastTime) / 1000; // 초 단위로 변환
        this.lastTime = timestamp;

        if (deltaTime < 1) { // 첫 프레임이나 탭 전환 후 큰 deltaTime 방지
            this.update(deltaTime);
        }

        this.draw();
        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

// 게임 시작
window.addEventListener('load', () => {
    new Game();
});
