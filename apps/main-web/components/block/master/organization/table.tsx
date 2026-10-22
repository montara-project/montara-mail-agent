'use client'

import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable from '@/components/block/common/react-table'
import SectionCard from '@/components/block/common/section-card'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { OrganizationColumn } from './column'
import { AddOrganizationForm } from './form'

export default function OrganizationTable() {
  const [openAdd, setOpenAdd] = useState(false)
  const { offset, limit, pageIndex } = usePaginationQuery()

  const [search, setSearch] = useQueryState('search')
  const debouncedSearch = useDebounce({ value: search ?? '', delay: 500 })

  const params = useMemo(
    () => ({
      offset,
      limit,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [offset, limit, debouncedSearch]
  )

  const { data, isFetching, isLoading, isError, error } = useQuery(
    queries.organizations.list(params)
  )
  const loading = isLoading || isFetching
  const total = data?.metadata?.total ?? 0
  const organizations = data?.data ?? []

  useEffect(() => {
    if (isError) toastAxiosError(error)
  }, [isError, error])

  const columns = OrganizationColumn({ loading })

  return (
    <SectionCard
      title="Organizations"
      description="Tenants that own students, assignments and assessment categories."
      toolbar={
        <div className="flex flex-row items-center gap-2">
          <InputWrapper className="w-72">
            <IconSearch />
            <Input
              placeholder="Search organizations..."
              value={search ?? ''}
              onChange={(e) => void setSearch(e.target.value || null)}
            />
          </InputWrapper>

          <Button className="h-8.5 rounded-lg" onClick={() => setOpenAdd(true)}>
            <IconPlus />
            <span>Add Organization</span>
          </Button>
        </div>
      }
    >
      {!loading && organizations.length === 0 ? (
        <EmptyState
          title="No organizations found"
          description="Adjust the search, or add the first organization."
          action={
            <Button onClick={() => setOpenAdd(true)}>
              <IconPlus />
              <span>Add Organization</span>
            </Button>
          }
        />
      ) : (
        <ReactTable
          columns={columns}
          data={organizations}
          total={total}
          pageIndex={pageIndex}
          pageSize={limit}
        />
      )}

      <AddOrganizationForm open={openAdd} onOpenChange={setOpenAdd} />
    </SectionCard>
  )
}
