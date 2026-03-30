import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

export class NodeFactory {
  static createLabelNode(name: string, text: string, width: number, height: number, fontSize: number, color: Color) {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    const ui = node.addComponent(UITransform);
    ui.setContentSize(width, height);
    ui.setAnchorPoint(0.5, 0.5);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.floor(fontSize * 1.2);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = color;
    return { node, label };
  }

  static createButtonNode(name: string, text: string, width: number, height: number, fill: Color, stroke: Color) {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    const ui = node.addComponent(UITransform);
    ui.setContentSize(width, height);
    ui.setAnchorPoint(0.5, 0.5);
    const g = node.addComponent(Graphics);
    g.clear();
    g.fillColor = fill;
    g.roundRect(-width / 2, -height / 2, width, height, 10);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 48);
    g.roundRect(-width / 2 + 3, 0, width - 6, height / 2 - 3, 7);
    g.fill();
    g.strokeColor = new Color(20, 43, 95, 165);
    g.lineWidth = 1.5;
    g.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 8);
    g.stroke();
    g.strokeColor = stroke;
    g.lineWidth = 2;
    g.roundRect(-width / 2, -height / 2, width, height, 10);
    g.stroke();

    const { node: textNode, label } = this.createLabelNode('Text', text, width, height, 34, new Color(255, 255, 255, 255));
    node.addChild(textNode);
    return { node, label };
  }

  static createPanelNode(name: string, width: number, height: number, fill: Color, stroke?: Color, radius = 10) {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    const ui = node.addComponent(UITransform);
    ui.setContentSize(width, height);
    ui.setAnchorPoint(0.5, 0.5);
    const g = node.addComponent(Graphics);
    g.clear();
    g.fillColor = fill;
    g.roundRect(-width / 2, -height / 2, width, height, radius);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 24);
    g.roundRect(-width / 2 + 3, 0, width - 6, height / 2 - 3, Math.max(3, radius - 2));
    g.fill();
    if (stroke) {
      g.strokeColor = stroke;
      g.lineWidth = 2;
      g.roundRect(-width / 2, -height / 2, width, height, radius);
      g.stroke();
    }
    return node;
  }
}

