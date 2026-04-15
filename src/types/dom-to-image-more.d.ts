declare module 'dom-to-image-more' {
    interface DomToImageOptions {
        quality?: number;
        bgcolor?: string;
        width?: number;
        height?: number;
        style?: Record<string, string>;
        filter?: (node: Node) => boolean;
        imagePlaceholder?: string;
        cacheBust?: boolean;
    }

    const domToImageMore: {
        toPng(node: Node, options?: DomToImageOptions): Promise<string>;
        toJpeg(node: Node, options?: DomToImageOptions): Promise<string>;
        toBlob(node: Node, options?: DomToImageOptions): Promise<Blob>;
        toSvg(node: Node, options?: DomToImageOptions): Promise<string>;
        toPixelData(node: Node, options?: DomToImageOptions): Promise<Uint8ClampedArray>;
    };

    export default domToImageMore;
}
