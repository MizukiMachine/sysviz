import * as THREE from 'three';

export const FLASK_NODES = [
    {
        id: 'browser-request',
        name: 'Browser',
        type: 'browser',
        shape: 'sphere',
        status: 'idle',
        color: 0x6C9BD2,
        x: -10,
        y: 0,
        z: 0,
        dataIn: 'User action',
        dataOut: 'HTTP request (GET /hello)',
        floatOffset: 0.0,
        glowOffset: 0.3
    },
    {
        id: 'wsgi-server',
        name: 'WSGI Server',
        type: 'server',
        shape: 'cylinder',
        status: 'idle',
        color: 0x7BC67E,
        x: -5,
        y: 0,
        z: 0,
        dataIn: 'HTTP request',
        dataOut: 'WSGI environ dict',
        floatOffset: 0.6,
        glowOffset: 0.9
    },
    {
        id: 'routing',
        name: 'Routing',
        type: 'application',
        shape: 'diamond',
        status: 'idle',
        color: 0xD4A76A,
        x: 0,
        y: 0,
        z: 0,
        dataIn: 'environ dict',
        dataOut: 'Matched view function',
        floatOffset: 1.2,
        glowOffset: 1.5
    },
    {
        id: 'view-function',
        name: 'View Function',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0xC77DBA,
        x: 5,
        y: 0,
        z: 0,
        dataIn: 'URL params',
        dataOut: 'Response object',
        floatOffset: 1.8,
        glowOffset: 2.1
    },
    {
        id: 'response',
        name: 'Response',
        type: 'response',
        shape: 'torus',
        status: 'idle',
        color: 0xD4826A,
        x: 10,
        y: 0,
        z: 0,
        dataIn: 'Response object',
        dataOut: 'HTTP response (200 OK)',
        floatOffset: 2.4,
        glowOffset: 2.7
    },
    {
        id: 'browser-render',
        name: 'Browser',
        type: 'browser',
        shape: 'sphere',
        status: 'idle',
        color: 0x6C9BD2,
        x: 15,
        y: 0,
        z: 0,
        dataIn: 'HTTP response',
        dataOut: 'Rendered page',
        floatOffset: 3.0,
        glowOffset: 3.3
    }
];

export const FLASK_CONNECTIONS = [
    { id: 'conn-browser-wsgi', sourceId: 'browser-request', targetId: 'wsgi-server', type: 'network', trafficVolume: 2 },
    { id: 'conn-wsgi-routing', sourceId: 'wsgi-server', targetId: 'routing', type: 'sync', trafficVolume: 2 },
    { id: 'conn-routing-view', sourceId: 'routing', targetId: 'view-function', type: 'sync', trafficVolume: 2 },
    { id: 'conn-view-response', sourceId: 'view-function', targetId: 'response', type: 'sync', trafficVolume: 2 },
    { id: 'conn-response-browser', sourceId: 'response', targetId: 'browser-render', type: 'network', trafficVolume: 2 }
];

export const FLASK_TIMELINE = {
    duration: 35,
    keyframes: [
        { time: 0.0, type: 'resource', id: 'browser-request', status: 'active', caption: 'ユーザーがブラウザで「GET /hello」をリクエストします' },
        { time: 2.0, type: 'route', id: 'route-conn-browser-wsgi', active: true },
        { time: 5.8, type: 'route', id: 'route-conn-browser-wsgi', active: false },
        { time: 6.0, type: 'resource', id: 'wsgi-server', status: 'active', caption: 'WSGIサーバーがリクエストを受け取り、environ辞書に変換します' },
        { time: 6.0, type: 'resource', id: 'browser-request', status: 'complete' },
        { time: 8.0, type: 'route', id: 'route-conn-wsgi-routing', active: true },
        { time: 11.8, type: 'route', id: 'route-conn-wsgi-routing', active: false },
        { time: 12.0, type: 'resource', id: 'routing', status: 'active', caption: 'URLパターンから対応するビュー関数を特定します' },
        { time: 12.0, type: 'resource', id: 'wsgi-server', status: 'complete' },
        { time: 14.0, type: 'route', id: 'route-conn-routing-view', active: true },
        { time: 17.8, type: 'route', id: 'route-conn-routing-view', active: false },
        { time: 18.0, type: 'resource', id: 'view-function', status: 'active', caption: 'ビュー関数が実行され、ビジネスロジックを処理してレスポンスを生成します' },
        { time: 18.0, type: 'resource', id: 'routing', status: 'complete' },
        { time: 20.0, type: 'route', id: 'route-conn-view-response', active: true },
        { time: 23.8, type: 'route', id: 'route-conn-view-response', active: false },
        { time: 24.0, type: 'resource', id: 'response', status: 'active', caption: 'レスポンスオブジェクトがHTTPレスポンス (200 OK) に変換されます' },
        { time: 24.0, type: 'resource', id: 'view-function', status: 'complete' },
        { time: 26.0, type: 'route', id: 'route-conn-response-browser', active: true },
        { time: 31.8, type: 'route', id: 'route-conn-response-browser', active: false },
        { time: 32.0, type: 'resource', id: 'browser-render', status: 'active', caption: 'ブラウザがレスポンスを受け取り、画面に表示します' },
        { time: 32.0, type: 'resource', id: 'response', status: 'complete' }
    ]
};

export function buildTrafficRoutes(resourceMeshes) {
    return FLASK_CONNECTIONS.flatMap((connection, index) => {
        const sourceMesh = resourceMeshes.get(connection.sourceId);
        const targetMesh = resourceMeshes.get(connection.targetId);
        const sourceNode = FLASK_NODES.find((node) => node.id === connection.sourceId);
        const targetNode = FLASK_NODES.find((node) => node.id === connection.targetId);
        if (!sourceMesh || !targetMesh) {
            return [];
        }

        return [{
            id: `route-${connection.id}`,
            sourceId: connection.sourceId,
            targetId: connection.targetId,
            sourcePos: sourceMesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
            targetPos: targetMesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
            payload: sourceNode?.dataOut || targetNode?.dataIn || '',
            trafficType: index === FLASK_CONNECTIONS.length - 1 ? 'healthy' : 'default',
            requestRate: 1.25
        }];
    });
}
