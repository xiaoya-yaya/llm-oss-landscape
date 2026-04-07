// clickhouse-simple.ts

import axios from 'axios';

// 定义返回结构（仅在本文件内使用）
interface ClickHouseResponse {
    success: boolean;
    data: Array<Record<string, any>>;
    message?: string;
}

class ClickHouseClient {
    private baseUrl = 'https://mosn.io/api/insight/ck/getData';

    /**
     * 执行 SQL 查询，成功则返回 data 数组，失败返回 null
     */
    async query(
        sql: string,
        reqType: string
    ): Promise<Array<Record<string, any>> | null> {
        // 参数校验
        if (!sql?.trim()) {
            console.error('SQL is required');
            return null;
        }

        try {
            const response = await axios.get<ClickHouseResponse>(this.baseUrl, {
                params: { sql, reqType }
            });

            const { success, data } = response.data;

            if (success && Array.isArray(data)) {
                return data;
            } else {
                console.error(
                    'Query failed:',
                    response.data.message || 'Unknown error'
                );
                return null;
            }
        } catch (error) {
            console.error('Request error:', error);
            return null;
        }
    }
}

// 导出单例实例
export const ckClient = new ClickHouseClient();

export default ClickHouseClient;
