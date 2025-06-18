export class GameRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  drawSprite(x: number, y: number, width: number, height: number, color: string) {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width / 2, y - height / 2, width, height);
    this.ctx.restore();
  }

  drawCircle(x: number, y: number, radius: number, color: string, stroke = false) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    if (stroke) {
      this.ctx.strokeStyle = color;
      this.ctx.stroke();
    } else {
      this.ctx.fillStyle = color;
      this.ctx.fill();
    }
    
    this.ctx.restore();
  }

  drawText(text: string, x: number, y: number, size = 16, color = 'white', align: CanvasTextAlign = 'left') {
    this.ctx.save();
    this.ctx.font = `${size}px Inter, sans-serif`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.fillText(text, x, y);
    this.ctx.restore();
  }

  clear(width: number, height: number) {
    this.ctx.clearRect(0, 0, width, height);
  }

  drawGradient(x: number, y: number, width: number, height: number, colors: string[]) {
    const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
    colors.forEach((color, index) => {
      gradient.addColorStop(index / (colors.length - 1), color);
    });
    
    this.ctx.save();
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.restore();
  }
}
