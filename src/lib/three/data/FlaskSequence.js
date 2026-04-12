import * as THREE from 'three';

/**
 * Flask Sequence - Based on 05_sequence_request_lifecycle.mmd
 * Participants arranged linearly, timeline follows sequence interactions.
 *
 * Central orchestrator: Ctx (AppContext) - stays active throughout
 * Other participants activate/deactivate as messages flow
 */

export const SEQUENCE_CAMERA = {
    position: [0, 14, 22],
    target: [0, 0, 0]
};

export const SEQUENCE_NODES = [
    {
        id: 'seq-client',
        name: 'Client',
        type: 'browser',
        shape: 'sphere',
        status: 'idle',
        color: 0x6C9BD2,
        x: -14, y: 0, z: 0,
        dataIn: 'User action',
        dataOut: 'HTTP Request',
        floatOffset: 0.0,
        glowOffset: 0.3
    },
    {
        id: 'seq-wsgi',
        name: 'WSGI Entry',
        type: 'server',
        shape: 'cylinder',
        status: 'idle',
        color: 0x7BC67E,
        x: -10.5, y: 0, z: 0,
        dataIn: 'environ, start_response',
        dataOut: 'AppContext push',
        floatOffset: 0.5,
        glowOffset: 0.8
    },
    {
        id: 'seq-ctx',
        name: 'AppContext',
        type: 'application',
        shape: 'diamond',
        status: 'idle',
        color: 0x7BC7C4,
        x: -7, y: 0, z: 0,
        dataIn: 'AppContext',
        dataOut: 'current_app, g, request, session',
        floatOffset: 1.0,
        glowOffset: 1.3
    },
    {
        id: 'seq-session',
        name: 'Session',
        type: 'application',
        shape: 'cylinder',
        status: 'idle',
        color: 0x8BD49E,
        x: -3.5, y: 0, z: 0,
        dataIn: 'Cookie',
        dataOut: 'Session dict',
        floatOffset: 1.5,
        glowOffset: 1.8
    },
    {
        id: 'seq-before',
        name: 'before_request',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0xD4A76A,
        x: 0, y: 0, z: 0,
        dataIn: 'Request',
        dataOut: 'Continue / Response',
        floatOffset: 2.0,
        glowOffset: 2.3
    },
    {
        id: 'seq-router',
        name: 'URL Router',
        type: 'application',
        shape: 'diamond',
        status: 'idle',
        color: 0xD4A76A,
        x: 3.5, y: 0, z: 0,
        dataIn: 'path + method',
        dataOut: 'endpoint + view_args',
        floatOffset: 2.5,
        glowOffset: 2.8
    },
    {
        id: 'seq-view',
        name: 'View Function',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0xC77DBA,
        x: 7, y: 0, z: 0,
        dataIn: 'view_args',
        dataOut: 'Response / Data',
        floatOffset: 3.0,
        glowOffset: 3.3
    },
    {
        id: 'seq-after',
        name: 'after_request',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0x8BD49E,
        x: 10.5, y: 0, z: 0,
        dataIn: 'Response',
        dataOut: 'Modified Response',
        floatOffset: 3.5,
        glowOffset: 3.8
    },
    {
        id: 'seq-tdown',
        name: 'teardown',
        type: 'application',
        shape: 'default',
        status: 'idle',
        color: 0x9AABB8,
        x: 14, y: 0, z: 0,
        dataIn: 'Response',
        dataOut: 'Cleanup Done',
        floatOffset: 4.0,
        glowOffset: 4.3
    }
];

export const SEQUENCE_CONNECTIONS = [
    { id: 'conn-seq-client-wsgi', sourceId: 'seq-client', targetId: 'seq-wsgi', type: 'network', trafficVolume: 2 },
    { id: 'conn-seq-wsgi-ctx', sourceId: 'seq-wsgi', targetId: 'seq-ctx', type: 'sync', trafficVolume: 2 },
    { id: 'conn-seq-ctx-session', sourceId: 'seq-ctx', targetId: 'seq-session', type: 'sync', trafficVolume: 2 },
    { id: 'conn-seq-ctx-before', sourceId: 'seq-ctx', targetId: 'seq-before', type: 'signal', trafficVolume: 2 },
    { id: 'conn-seq-ctx-router', sourceId: 'seq-ctx', targetId: 'seq-router', type: 'sync', trafficVolume: 2 },
    { id: 'conn-seq-ctx-view', sourceId: 'seq-ctx', targetId: 'seq-view', type: 'sync', trafficVolume: 2 },
    { id: 'conn-seq-ctx-after', sourceId: 'seq-ctx', targetId: 'seq-after', type: 'signal', trafficVolume: 2 },
    { id: 'conn-seq-ctx-tdown', sourceId: 'seq-ctx', targetId: 'seq-tdown', type: 'sync', trafficVolume: 2 }
];

export const SEQUENCE_TIMELINE = {
    duration: 43,
    keyframes: [
        // 1. Client sends request
        { time: 0.0, type: 'resource', id: 'seq-client', status: 'active', caption: 'HTTP\u30ea\u30af\u30a8\u30b9\u30c8 (environ, start_response) \u3092\u9001\u4fe1\u3057\u307e\u3059' },
        { time: 1.0, type: 'route', id: 'route-conn-seq-client-wsgi', active: true },
        { time: 3.0, type: 'route', id: 'route-conn-seq-client-wsgi', active: false },
        // 2. WSGI receives
        { time: 3.5, type: 'resource', id: 'seq-wsgi', status: 'active', caption: 'Flask.__call__() \u304c\u30ea\u30af\u30a8\u30b9\u30c8\u3092\u53d7\u3051\u53d6\u308a\u307e\u3059' },
        { time: 3.5, type: 'resource', id: 'seq-client', status: 'complete' },
        { time: 4.5, type: 'route', id: 'route-conn-seq-wsgi-ctx', active: true },
        { time: 6.5, type: 'route', id: 'route-conn-seq-wsgi-ctx', active: false },
        // 3. Context push
        { time: 7.0, type: 'resource', id: 'seq-ctx', status: 'active', caption: 'push() \u3067AppContext\u3092\u4f5c\u6210 \u2192 current_app, g, request, session\u304c\u5229\u7528\u53ef\u80fd\u306b' },
        { time: 7.0, type: 'resource', id: 'seq-wsgi', status: 'complete' },
        // 4. Session open
        { time: 8.0, type: 'route', id: 'route-conn-seq-ctx-session', active: true },
        { time: 10.0, type: 'route', id: 'route-conn-seq-ctx-session', active: false },
        { time: 10.5, type: 'resource', id: 'seq-session', status: 'active', caption: 'open_session() \u3067Cookie\u304b\u3089\u30bb\u30c3\u30b7\u30e7\u30f3\u30c7\u30fc\u30bf\u3092\u8aad\u307f\u8fbc\u307f\u307e\u3059' },
        { time: 12.5, type: 'resource', id: 'seq-session', status: 'complete' },
        // 5. before_request
        { time: 13.5, type: 'route', id: 'route-conn-seq-ctx-before', active: true },
        { time: 15.5, type: 'route', id: 'route-conn-seq-ctx-before', active: false },
        { time: 16.0, type: 'resource', id: 'seq-before', status: 'active', caption: 'before_request\u30d5\u30c3\u30af\u3092\u5b9f\u884c\u3057\u307e\u3059\uff08\u8a8d\u8a3c\u30c1\u30a7\u30c3\u30af\u7b49\uff09' },
        { time: 18.0, type: 'resource', id: 'seq-before', status: 'complete' },
        // 6. URL Router
        { time: 19.0, type: 'route', id: 'route-conn-seq-ctx-router', active: true },
        { time: 21.0, type: 'route', id: 'route-conn-seq-ctx-router', active: false },
        { time: 21.5, type: 'resource', id: 'seq-router', status: 'active', caption: 'url_map.match(path, method) \u3067URL\u30d1\u30bf\u30fc\u30f3\u3092\u7167\u5408\u3057\u307e\u3059' },
        { time: 23.5, type: 'resource', id: 'seq-router', status: 'complete' },
        // 7. View Function
        { time: 24.5, type: 'route', id: 'route-conn-seq-ctx-view', active: true },
        { time: 26.5, type: 'route', id: 'route-conn-seq-ctx-view', active: false },
        { time: 27.0, type: 'resource', id: 'seq-view', status: 'active', caption: 'view_function(**view_args) \u3092\u5b9f\u884c\u3057\u307e\u3059' },
        { time: 29.0, type: 'resource', id: 'seq-view', status: 'complete' },
        // 8. after_request
        { time: 30.0, type: 'route', id: 'route-conn-seq-ctx-after', active: true },
        { time: 32.0, type: 'route', id: 'route-conn-seq-ctx-after', active: false },
        { time: 32.5, type: 'resource', id: 'seq-after', status: 'active', caption: 'after_request\u30d5\u30c3\u30af\u3067\u30ec\u30b9\u30dd\u30f3\u30b9\u3092\u4fee\u6b63\u3057\u307e\u3059' },
        { time: 34.5, type: 'resource', id: 'seq-after', status: 'complete' },
        // 9. Session save (reuse ctx→session route)
        { time: 35.5, type: 'route', id: 'route-conn-seq-ctx-session', active: true },
        { time: 37.5, type: 'route', id: 'route-conn-seq-ctx-session', active: false },
        { time: 38.0, type: 'resource', id: 'seq-session', status: 'active', caption: 'save_session() \u3067\u30bb\u30c3\u30b7\u30e7\u30f3\u30c7\u30fc\u30bf\u3092Cookie\u306b\u4fdd\u5b58\u3057\u307e\u3059' },
        { time: 40.0, type: 'resource', id: 'seq-session', status: 'complete' },
        // 10. teardown + context pop
        { time: 40.5, type: 'route', id: 'route-conn-seq-ctx-tdown', active: true },
        { time: 42.5, type: 'route', id: 'route-conn-seq-ctx-tdown', active: false },
        { time: 43.0, type: 'resource', id: 'seq-tdown', status: 'active', caption: 'teardown_request\u30d5\u30c3\u30af\u3067\u30ea\u30bd\u30fc\u30b9\u3092\u30af\u30ea\u30fc\u30f3\u30a2\u30c3\u30d7\u3057\u307e\u3059' },
        { time: 43.0, type: 'resource', id: 'seq-ctx', status: 'complete' }
    ]
};

export function buildTrafficRoutes(resourceMeshes) {
    return SEQUENCE_CONNECTIONS.flatMap((connection) => {
        const sourceMesh = resourceMeshes.get(connection.sourceId);
        const targetMesh = resourceMeshes.get(connection.targetId);
        const sourceNode = SEQUENCE_NODES.find((n) => n.id === connection.sourceId);
        if (!sourceMesh || !targetMesh) return [];

        return [{
            id: `route-${connection.id}`,
            sourceId: connection.sourceId,
            targetId: connection.targetId,
            sourcePos: sourceMesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
            targetPos: targetMesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
            payload: sourceNode?.dataOut || '',
            trafficType: connection.id === 'conn-seq-ctx-tdown' ? 'healthy' : 'default',
            requestRate: 1.25
        }];
    });
}
