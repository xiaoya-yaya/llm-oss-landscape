import { useRequest } from "ahooks";

import { GITHUB_PAGES_URL_PATH } from "@site/constants";
import fetchData from "@site/src/utils/fetchData";

export const getStaticDataUrl = (relativePath: string) => {
  return `${GITHUB_PAGES_URL_PATH}/data/${relativePath}`;
}

export const getStaticImageUrl = (relativePath: string) => {
  return `${GITHUB_PAGES_URL_PATH}/img/${relativePath}`;
}

interface UseDataProps {  url: string; type?: 'json' | 'csv'}

const useData = <T,>({url, type = 'json'}: UseDataProps ) => {
    const {data, loading} = useRequest(() => fetchData({url, type}), {
        cacheKey: url,
        cacheTime: 1000 * 60 * 60 * 24,
    })

    return {data: data as T | undefined, loading}
}

export default useData;
