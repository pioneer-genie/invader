// 게임 설정
const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLANET_COUNT: 12,
    SHIP_PRODUCTION_RATE: 0.5, // 초당 생산되는 함선 수
    SHIP_SPEED: 100, // 픽셀/초
    PLAYER: 1,
    ENEMY: 2,
    NEUTRAL: 0
};

// 행성 클래스
class Planet {
    constructor(x, y, radius, owner = CONFIG.NEUTRAL) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.owner = owner;
        this.ships = owner === CONFIG.NEUTRAL ? Math.floor(Math.random() * 30 + 10) : 50;
        this.productionRate = radius / 15; // 큰 행성일수록 생산 속도 빠름
    }

    produceShips(deltaTime) {
        if (this.owner !== CONFIG.NEUTRAL) {
            this.ships += CONFIG.SHIP_PRODUCTION_RATE * this.productionRate * deltaTime;
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

                // 첫 번째 행성은 플레이어, 두 번째는 적
                if (i === 0) owner = CONFIG.PLAYER;
                else if (i === 1) owner = CONFIG.ENEMY;

                this.planets.push(new Planet(x, y, radius, owner));
            }
        }
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // 클릭한 행성 찾기
            const clickedPlanet = this.planets.find(p => p.contains(x, y));

            if (clickedPlanet) {
                if (this.selectedPlanet && this.selectedPlanet !== clickedPlanet) {
                    // 선택된 행성에서 클릭한 행성으로 공격
                    if (this.selectedPlanet.owner === CONFIG.PLAYER && this.selectedPlanet.ships >= 1) {
                        const shipsToSend = Math.floor(this.selectedPlanet.ships * 0.5);
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
    }

    sendShips(from, to, ships) {
        this.shipGroups.push(new ShipGroup(from, to, ships, from.owner));
    }

    update(deltaTime) {
        // 행성 함선 생산
        for (let planet of this.planets) {
            planet.produceShips(deltaTime);
        }

        // 함선 그룹 이동 및 공격
        for (let i = this.shipGroups.length - 1; i >= 0; i--) {
            const group = this.shipGroups[i];
            if (group.update(deltaTime)) {
                group.attack();
                this.shipGroups.splice(i, 1);
            }
        }

        // AI 행동
        this.updateAI();

        // UI 업데이트
        this.updateUI();
    }

    updateAI() {
        if (Math.random() < 0.02) { // 2% 확률로 AI 행동
            const enemyPlanets = this.planets.filter(p => p.owner === CONFIG.ENEMY && p.ships > 20);
            if (enemyPlanets.length === 0) return;

            const sourcePlanet = enemyPlanets[Math.floor(Math.random() * enemyPlanets.length)];

            // 타겟 선택 (플레이어 행성 우선, 없으면 중립)
            const playerPlanets = this.planets.filter(p => p.owner === CONFIG.PLAYER);
            const neutralPlanets = this.planets.filter(p => p.owner === CONFIG.NEUTRAL);
            const targets = playerPlanets.length > 0 ? playerPlanets : neutralPlanets;

            if (targets.length > 0) {
                // 가장 가까운 약한 타겟 찾기
                let bestTarget = null;
                let bestScore = -1;

                for (let target of targets) {
                    const dx = target.x - sourcePlanet.x;
                    const dy = target.y - sourcePlanet.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const score = (sourcePlanet.ships - target.ships) / distance;

                    if (score > bestScore && sourcePlanet.ships > target.ships * 1.5) {
                        bestScore = score;
                        bestTarget = target;
                    }
                }

                if (bestTarget) {
                    const shipsToSend = Math.floor(sourcePlanet.ships * 0.6);
                    this.sendShips(sourcePlanet, bestTarget, shipsToSend);
                    sourcePlanet.ships -= shipsToSend;
                }
            }
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
