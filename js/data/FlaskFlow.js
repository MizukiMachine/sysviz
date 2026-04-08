import * as THREE from 'three';

export const FLASK_NODES = [
    {
        id: 'browser-request',
        name: 'Browser',
        type: 'browser',
        shape: 'default',
        status: 'idle',
        color: 0x6C9BD2,
        x: -12,
        y: 0,
        z: 3,
        dataIn: 'User action',
        dataOut: 'HTTP request (GET /hello)',
        floatOffset: 0.0,
        glowOffset: 0.3
    },
    {
        id: 'wsgi-server',
        name: 'WSGI Server',
        type: 'server',
        shape: 'default',
        status: 'idle',
        color: 0x7BC67E,
        x: -7,
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
        shape: 'default',
        status: 'idle',
        color: 0xD4A76A,
        x: -2,
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
        x: 3,
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
        shape: 'default',
        status: 'idle',
        color: 0xD4826A,
        x: 8,
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
        shape: 'default',
        status: 'idle',
        color: 0x6C9BD2,
        x: 13,
        y: 0,
        z: -3,
        dataIn: 'HTTP response',
        dataOut: 'Rendered page',
        floatOffset: 3.0,
        glowOffset: 3.3
    }
];

export const FLASK_CONNECTIONS = [
    { id: 'conn-browser-wsgi', sourceId: 'browser-request', targetId: 'wsgi-server', type: 'network', trafficVolume: 2 },
    { id: 'conn-wsgi-routing', sourceId: 'wsgi-server', targetId: 'routing', type: 'network', trafficVolume: 2 },
    { id: 'conn-routing-view', sourceId: 'routing', targetId: 'view-function', type: 'network', trafficVolume: 2 },
    { id: 'conn-view-response', sourceId: 'view-function', targetId: 'response', type: 'network', trafficVolume: 2 },
    { id: 'conn-response-browser', sourceId: 'response', targetId: 'browser-render', type: 'network', trafficVolume: 2 }
];

export function buildTrafficRoutes(resourceMeshes) {
    return FLASK_CONNECTIONS.flatMap((connection, index) => {
        const sourceMesh = resourceMeshes.get(connection.sourceId);
        const targetMesh = resourceMeshes.get(connection.targetId);
        if (!sourceMesh || !targetMesh) {
            return [];
        }

        return [{
            id: `route-${connection.id}`,
            sourceId: connection.sourceId,
            targetId: connection.targetId,
            sourcePos: sourceMesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
            targetPos: targetMesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
            trafficType: index === FLASK_CONNECTIONS.length - 1 ? 'healthy' : 'default',
            requestRate: 1.25
        }];
    });
}
