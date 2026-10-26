/**
 * @license
 * Copyright (c) 2025 Efstratios Goudelis
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {useEffect, useState} from 'react';
import MuiPagination from '@mui/material/Pagination';
import TablePaginationActions from '@mui/material/TablePaginationActions';
import {gridPageCountSelector, useGridApiContext, useGridSelector} from '@mui/x-data-grid';

const MIN_NUMBERED_PAGINATION_WIDTH = 700;

export default function GridPaginationActions(props) {
    const {page, onPageChange, className} = props;
    const apiRef = useGridApiContext();
    const pageCount = useGridSelector(apiRef, gridPageCountSelector);
    const [gridWidth, setGridWidth] = useState(0);

    useEffect(() => {
        const gridElement = apiRef.current.rootElementRef?.current;
        if (!gridElement) return undefined;

        const updateWidth = () => setGridWidth(gridElement.clientWidth);
        updateWidth();

        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(updateWidth);
        observer.observe(gridElement);
        return () => observer.disconnect();
    }, [apiRef]);

    // Use the compact native actions when the numbered buttons would crowd
    // the page size and row range controls in the footer.
    if (gridWidth < MIN_NUMBERED_PAGINATION_WIDTH) {
        return <TablePaginationActions {...props} />;
    }

    // Show more nearby destinations as the table gets wider.
    const siblingCount = gridWidth >= 1200 ? 2 : gridWidth >= 900 ? 1 : 0;

    return (
        <MuiPagination
            color="primary"
            className={className}
            count={pageCount}
            page={page + 1}
            boundaryCount={1}
            siblingCount={siblingCount}
            size={gridWidth < 850 ? 'small' : 'medium'}
            onChange={(event, newPage) => {
                onPageChange(event, newPage - 1);
            }}
        />
    );
}
