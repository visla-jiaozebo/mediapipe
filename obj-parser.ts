/**
 * OBJ文件解析器 - 专门用于解析canonical_face_model.obj
 * 将顶点数据标准化到[0,1]范围
 */

interface ParsedOBJData {
    vertices:  { x: number, y: number, z: number }[];        // 标准化的顶点坐标 [0,1]
    originalVertices: Float32Array; // 原始顶点坐标
    bounds: {
        min: { x: number, y: number, z: number };
        max: { x: number, y: number, z: number };
    };
    vertexCount: number;
}

class OBJParser {
    /**
     * 解析OBJ文件内容
     */
    static async parseOBJFile(filePath: string): Promise<{ x: number, y: number, z: number }[]> {
        try {
            const response = await fetch(filePath);
            const objContent = await response.text();
            
            return this.parseOBJContent(objContent);
        } catch (error) {
            console.error('Failed to load OBJ file:', error);
            throw error;
        }
    }
    
    /**
     * 解析OBJ文件内容字符串
     */
    static parseOBJContent(objContent: string): { x: number, y: number, z: number }[] {
        const lines = objContent.split('\n');
        const vertices: number[] = [];
        
        // 临时存储原始顶点以计算边界
        const rawVertices: { x: number, y: number, z: number }[] = [];
        
        // 解析顶点
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 解析顶点行 "v x y z"
            if (trimmedLine.startsWith('v ')) {
                const parts = trimmedLine.split(/\s+/);
                if (parts.length >= 4) {
                    const x = parseFloat(parts[1]);
                    const y = parseFloat(parts[2]);
                    const z = parseFloat(parts[3]);
                    
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                        rawVertices.push({ x, y, z });
                    }
                }
            }
        }
        
        if (rawVertices.length === 0) {
            throw new Error('No vertices found in OBJ file');
        }
        
        // 计算边界框
        const bounds = this.calculateBounds(rawVertices);
        
        // 标准化顶点到[0,1]范围
        const normalizedVertices = this.normalizeVertices(rawVertices, bounds);
        
        // 转换为Float32Array
        const originalVerticesArray = new Float32Array(rawVertices.length * 3);
        const normalizedVerticesArray = new Float32Array(rawVertices.length * 3);
        
        for (let i = 0; i < rawVertices.length; i++) {
            // 原始顶点
            originalVerticesArray[i * 3] = rawVertices[i].x;
            originalVerticesArray[i * 3 + 1] = rawVertices[i].y;
            originalVerticesArray[i * 3 + 2] = rawVertices[i].z;
            
            // 标准化顶点
            normalizedVerticesArray[i * 3] = normalizedVertices[i].x;
            normalizedVerticesArray[i * 3 + 1] = normalizedVertices[i].y;
            normalizedVerticesArray[i * 3 + 2] = normalizedVertices[i].z;
        }
        
        console.log(`OBJ解析完成: ${rawVertices.length} 个顶点`);
        console.log('边界框:', bounds);
        
        return normalizedVertices;
    }
    
    /**
     * 计算顶点边界框
     */
    private static calculateBounds(vertices: { x: number, y: number, z: number }[]): {
        min: { x: number, y: number, z: number };
        max: { x: number, y: number, z: number };
    } {
        if (vertices.length === 0) {
            throw new Error('No vertices to calculate bounds');
        }
        
        const first = vertices[0];
        const bounds = {
            min: { x: first.x, y: first.y, z: first.z },
            max: { x: first.x, y: first.y, z: first.z }
        };
        
        for (const vertex of vertices) {
            bounds.min.x = Math.min(bounds.min.x, vertex.x);
            bounds.min.y = Math.min(bounds.min.y, vertex.y);
            bounds.min.z = Math.min(bounds.min.z, vertex.z);
            
            bounds.max.x = Math.max(bounds.max.x, vertex.x);
            bounds.max.y = Math.max(bounds.max.y, vertex.y);
            bounds.max.z = Math.max(bounds.max.z, vertex.z);
        }
        
        return bounds;
    }
    
    /**
     * 将顶点标准化到[0,1]范围
     */
    private static normalizeVertices(
        vertices: { x: number, y: number, z: number }[], 
        bounds: { min: { x: number, y: number, z: number }, max: { x: number, y: number, z: number } }
    ): { x: number, y: number, z: number }[] {
        const sizeX = bounds.max.x - bounds.min.x;
        const sizeY = bounds.max.y - bounds.min.y;
        const sizeZ = bounds.max.z - bounds.min.z;
        
        // 避免除零
        const safeSize = {
            x: sizeX || 1,
            y: sizeY || 1,
            z: sizeZ || 1
        };
        
        return vertices.map(vertex => ({
            x: (vertex.x - bounds.min.x) / safeSize.x,
            y: (vertex.y - bounds.min.y) / safeSize.y,
            z: (vertex.z - bounds.min.z) / safeSize.z
        }));
    }
    
}

export { OBJParser };
export type { ParsedOBJData };
