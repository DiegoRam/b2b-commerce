'use client'

import React, { useState } from 'react'
import { ChevronDown, Building2, Check } from 'lucide-react'
import { useSubdomain } from '@/components/providers/SubdomainProvider'

export function OrganizationSwitcher() {
  const { currentOrganization, userMemberships, userRole, switchToOrganization } = useSubdomain()
  const [isOpen, setIsOpen] = useState(false)

  // Don't render if user only has access to one organization
  if (!currentOrganization || userMemberships.length <= 1) {
    return null
  }

  const handleSwitchOrganization = (subdomain: string) => {
    if (subdomain !== currentOrganization.subdomain) {
      switchToOrganization(subdomain)
    }
    setIsOpen(false)
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Building2 className="h-4 w-4 text-gray-500" />
        <div className="flex flex-col items-start min-w-0">
          <span className="font-medium text-gray-900 truncate">
            {currentOrganization.name}
          </span>
          <span className="text-xs text-gray-500 capitalize">
            {userRole}
          </span>
        </div>
        <ChevronDown 
          className={`h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                Switch Organization
              </div>
              
              {userMemberships.map((membership) => {
                const isCurrentOrg = membership.organization?.id === currentOrganization.id
                
                return (
                  <button
                    key={membership.id}
                    onClick={() => handleSwitchOrganization(membership.organization?.subdomain || '')}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors ${
                      isCurrentOrg ? 'bg-blue-50' : ''
                    }`}
                    disabled={isCurrentOrg}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                            isCurrentOrg 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {membership.organization?.name?.charAt(0).toUpperCase() || 'O'}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${
                            isCurrentOrg ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            {membership.organization?.name}
                          </p>
                          <p className={`text-xs truncate capitalize ${
                            isCurrentOrg ? 'text-blue-600' : 'text-gray-500'
                          }`}>
                            {membership.role}
                          </p>
                        </div>
                      </div>
                      {isCurrentOrg && (
                        <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}