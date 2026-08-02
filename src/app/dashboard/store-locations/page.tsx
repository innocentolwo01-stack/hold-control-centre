'use client';

import {
  Building2,
  MapPinned,
  Plus,
  RefreshCw,
  ScanLine,
  Store,
  UserRoundCheck,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';

type Partner = {
  id: string;
  name: string;
  websiteUrl?: string | null;
  status: string;
};

type Location = {
  id: string;
  partnerId: string;
  partnerName: string;
  name: string;
  externalReference?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
  countryCode: string;
  latitude?: number | null;
  longitude?: number | null;
  active: boolean;
  staffCount: number;
};

type MerchantStaff = {
  id: string;
  userId: string;
  email: string;
  partnerId: string;
  partnerName: string;
  locationId?: string | null;
  locationName?: string | null;
  role: 'scanner' | 'manager' | 'partner_admin';
  active: boolean;
};

type OperationsResponse = {
  partners?: Partner[];
  locations?: Location[];
  staff?: MerchantStaff[];
};

type LocationForm = {
  id: string;
  partnerId: string;
  name: string;
  externalReference: string;
  address: string;
  city: string;
  postcode: string;
  countryCode: string;
  latitude: string;
  longitude: string;
  active: boolean;
};

const emptyLocationForm: LocationForm = {
  id: '',
  partnerId: '',
  name: '',
  externalReference: '',
  address: '',
  city: '',
  postcode: '',
  countryCode: 'GB',
  latitude: '',
  longitude: '',
  active: true,
};

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function optionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `"${value}" is not a valid coordinate.`,
    );
  }

  return parsed;
}

export default function StoreLocationsPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [staff, setStaff] = useState<MerchantStaff[]>([]);

  const [locationForm, setLocationForm] =
    useState<LocationForm>(emptyLocationForm);
  const [locationModalOpen, setLocationModalOpen] =
    useState(false);

  const [staffForm, setStaffForm] = useState({
    email: '',
    partnerId: '',
    locationId: '',
    role: 'scanner',
    active: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    const { data, error: rpcError } =
      await supabase.rpc(
        'admin_merchant_operations',
      );

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    const response =
      (data as OperationsResponse | null) ?? {};

    const nextPartners = response.partners ?? [];
    const nextLocations = response.locations ?? [];

    setPartners(nextPartners);
    setLocations(nextLocations);
    setStaff(response.staff ?? []);

    setStaffForm((current) => {
      const partnerId =
        current.partnerId ||
        nextPartners[0]?.id ||
        '';

      const validLocation = nextLocations.find(
        (location) =>
          location.id === current.locationId &&
          location.partnerId === partnerId,
      );

      const firstPartnerLocation =
        nextLocations.find(
          (location) =>
            location.partnerId === partnerId &&
            location.active,
        );

      return {
        ...current,
        partnerId,
        locationId:
          validLocation?.id ??
          firstPartnerLocation?.id ??
          '',
      };
    });

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedPartnerLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          location.partnerId ===
          staffForm.partnerId,
      ),
    [locations, staffForm.partnerId],
  );

  function openNewLocation() {
    setLocationForm({
      ...emptyLocationForm,
      partnerId: partners[0]?.id ?? '',
    });
    setError('');
    setSuccess('');
    setLocationModalOpen(true);
  }

  function openLocation(location: Location) {
    setLocationForm({
      id: location.id,
      partnerId: location.partnerId,
      name: location.name,
      externalReference:
        location.externalReference ?? '',
      address: location.address ?? '',
      city: location.city ?? '',
      postcode: location.postcode ?? '',
      countryCode: location.countryCode || 'GB',
      latitude:
        location.latitude === null ||
        location.latitude === undefined
          ? ''
          : String(location.latitude),
      longitude:
        location.longitude === null ||
        location.longitude === undefined
          ? ''
          : String(location.longitude),
      active: location.active,
    });
    setError('');
    setSuccess('');
    setLocationModalOpen(true);
  }

  async function saveLocation() {
    if (!locationForm.partnerId) {
      setError('Select a partner.');
      return;
    }

    if (!locationForm.name.trim()) {
      setError('Enter the branch or store name.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error: rpcError } =
        await supabase.rpc(
          'admin_save_partner_location',
          {
            p_id: locationForm.id || null,
            p_partner_id:
              locationForm.partnerId,
            p_name: locationForm.name.trim(),
            p_external_reference:
              locationForm.externalReference.trim() ||
              null,
            p_address:
              locationForm.address.trim() || null,
            p_city:
              locationForm.city.trim() || null,
            p_postcode:
              locationForm.postcode.trim() || null,
            p_country_code:
              locationForm.countryCode
                .trim()
                .toUpperCase() || 'GB',
            p_latitude: optionalNumber(
              locationForm.latitude,
            ),
            p_longitude: optionalNumber(
              locationForm.longitude,
            ),
            p_active: locationForm.active,
          },
        );

      if (rpcError) throw rpcError;

      setLocationModalOpen(false);
      setSuccess(
        locationForm.id
          ? 'Store location updated.'
          : 'Store location created.',
      );
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save the store location.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function assignStaff() {
    if (!staffForm.email.trim()) {
      setError(
        'Enter the registered Hold account email.',
      );
      return;
    }

    if (!staffForm.partnerId) {
      setError('Select a partner.');
      return;
    }

    if (!staffForm.locationId) {
      setError(
        'Select the exact branch this scanner belongs to.',
      );
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const { error: rpcError } =
      await supabase.rpc(
        'admin_assign_merchant_staff',
        {
          p_email: staffForm.email.trim(),
          p_partner_id:
            staffForm.partnerId,
          p_location_id:
            staffForm.locationId,
          p_role: staffForm.role,
          p_active: staffForm.active,
        },
      );

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    setStaffForm((current) => ({
      ...current,
      email: '',
    }));
    setSuccess(
      'Merchant scanner account assigned to the selected store.',
    );
    setSaving(false);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Store Locations"
        description="Register every physical branch and assign each merchant scanner account to the exact store where redemptions are confirmed."
        actions={
          <>
            <Button
              type="button"
              className="secondary"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>

            <Button
              type="button"
              onClick={openNewLocation}
              disabled={partners.length === 0}
            >
              <Plus size={16} />
              Add store
            </Button>
          </>
        }
      />

      {error ? <p className="error">{error}</p> : null}
      {success ? (
        <p className="success">{success}</p>
      ) : null}

      <div className="grid three">
        <Card>
          <div className="stat">
            <div className="stat-icon">
              <Store size={21} />
            </div>
            <div>
              <strong>{locations.length}</strong>
              <span>Registered stores</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="stat">
            <div className="stat-icon">
              <MapPinned size={21} />
            </div>
            <div>
              <strong>
                {
                  locations.filter(
                    (location) => location.active,
                  ).length
                }
              </strong>
              <span>Active locations</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="stat">
            <div className="stat-icon">
              <UserRoundCheck size={21} />
            </div>
            <div>
              <strong>
                {
                  staff.filter(
                    (member) =>
                      member.active &&
                      member.locationId,
                  ).length
                }
              </strong>
              <span>Assigned scanner accounts</span>
            </div>
          </div>
        </Card>
      </div>

      <div
        className="grid two"
        style={{ marginTop: 18 }}
      >
        <Card>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              marginBottom: 14,
            }}
          >
            <ScanLine size={20} />
            <h2 style={{ margin: 0 }}>
              Assign merchant scanner
            </h2>
          </div>

          <p className="muted">
            The person must already have a Hold
            account. Every confirmed scan will inherit
            this assigned branch automatically.
          </p>

          <div
            className="form-grid"
            style={{ marginTop: 16 }}
          >
            <Field label="Hold account email">
              <Input
                type="email"
                value={staffForm.email}
                onChange={(event) =>
                  setStaffForm({
                    ...staffForm,
                    email: event.target.value,
                  })
                }
                placeholder="staff@retailer.com"
              />
            </Field>

            <Field label="Partner">
              <Select
                value={staffForm.partnerId}
                onChange={(event) => {
                  const partnerId =
                    event.target.value;
                  const firstLocation =
                    locations.find(
                      (location) =>
                        location.partnerId ===
                          partnerId &&
                        location.active,
                    );

                  setStaffForm({
                    ...staffForm,
                    partnerId,
                    locationId:
                      firstLocation?.id ?? '',
                  });
                }}
              >
                <option value="">
                  Select partner
                </option>
                {partners.map((partner) => (
                  <option
                    key={partner.id}
                    value={partner.id}
                  >
                    {partner.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Exact branch">
              <Select
                value={staffForm.locationId}
                onChange={(event) =>
                  setStaffForm({
                    ...staffForm,
                    locationId:
                      event.target.value,
                  })
                }
              >
                <option value="">
                  Select store location
                </option>
                {selectedPartnerLocations.map(
                  (location) => (
                    <option
                      key={location.id}
                      value={location.id}
                    >
                      {location.name}
                      {location.city
                        ? ` — ${location.city}`
                        : ''}
                    </option>
                  ),
                )}
              </Select>
            </Field>

            <Field label="Scanner role">
              <Select
                value={staffForm.role}
                onChange={(event) =>
                  setStaffForm({
                    ...staffForm,
                    role: event.target.value,
                  })
                }
              >
                <option value="scanner">
                  Scanner
                </option>
                <option value="manager">
                  Store manager
                </option>
                <option value="partner_admin">
                  Partner administrator
                </option>
              </Select>
            </Field>
          </div>

          <div className="form-actions">
            <Button
              type="button"
              onClick={() => void assignStaff()}
              disabled={saving}
            >
              Assign scanner to store
            </Button>
          </div>
        </Card>

        <Card>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              marginBottom: 14,
            }}
          >
            <Building2 size={20} />
            <h2 style={{ margin: 0 }}>
              Attribution result
            </h2>
          </div>

          <div className="kpi-list">
            <div className="kpi-row">
              <span>Merchant account</span>
              <strong>
                Assigned to one partner
              </strong>
            </div>
            <div className="kpi-row">
              <span>Scanner account</span>
              <strong>
                Assigned to one exact branch
              </strong>
            </div>
            <div className="kpi-row">
              <span>Successful barcode scan</span>
              <strong>
                Branch written to redemption
              </strong>
            </div>
            <div className="kpi-row">
              <span>Offer Activity</span>
              <strong>
                Store name and address shown
              </strong>
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 18 }}>
        <h2>Registered store locations</h2>

        {loading ? (
          <div className="empty-state">
            <strong>
              Loading store locations…
            </strong>
          </div>
        ) : locations.length === 0 ? (
          <EmptyState
            title="No stores registered"
            body="Add each physical branch before assigning merchant scanner accounts. Future in-store redemptions will then identify the exact store."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Store or branch</th>
                  <th>Address</th>
                  <th>Reference</th>
                  <th>Scanner accounts</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => (
                  <tr key={location.id}>
                    <td>
                      <strong>
                        {location.partnerName}
                      </strong>
                    </td>

                    <td>
                      <strong>{location.name}</strong>
                      <br />
                      <small className="muted">
                        {[
                          location.city,
                          location.countryCode,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </small>
                    </td>

                    <td>
                      {location.address || '—'}
                      <br />
                      <small className="muted">
                        {location.postcode || ''}
                      </small>
                    </td>

                    <td>
                      {location.externalReference ||
                        '—'}
                    </td>

                    <td>{location.staffCount}</td>

                    <td>
                      <Badge
                        tone={
                          location.active
                            ? 'good'
                            : 'neutral'
                        }
                      >
                        {location.active
                          ? 'Active'
                          : 'Inactive'}
                      </Badge>
                    </td>

                    <td>
                      <Button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          openLocation(location)
                        }
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 18 }}>
        <h2>Merchant scanner assignments</h2>

        {staff.length === 0 ? (
          <EmptyState
            title="No scanner accounts assigned"
            body="Assign a registered Hold account to a partner and exact store location."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Partner</th>
                  <th>Exact branch</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.email}</strong>
                    </td>
                    <td>{member.partnerName}</td>
                    <td>
                      {member.locationName ||
                        'No branch assigned'}
                    </td>
                    <td>
                      {titleCase(member.role)}
                    </td>
                    <td>
                      <Badge
                        tone={
                          member.active
                            ? 'good'
                            : 'neutral'
                        }
                      >
                        {member.active
                          ? 'Active'
                          : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {locationModalOpen ? (
        <Modal
          title={
            locationForm.id
              ? 'Manage store location'
              : 'Add store location'
          }
          onClose={() =>
            setLocationModalOpen(false)
          }
        >
          <div className="form-grid">
            <Field label="Partner">
              <Select
                value={locationForm.partnerId}
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    partnerId:
                      event.target.value,
                  })
                }
              >
                <option value="">
                  Select partner
                </option>
                {partners.map((partner) => (
                  <option
                    key={partner.id}
                    value={partner.id}
                  >
                    {partner.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Store or branch name"
              hint="For example: Tesco Liverpool One."
            >
              <Input
                value={locationForm.name}
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    name: event.target.value,
                  })
                }
                placeholder="Liverpool One"
              />
            </Field>

            <Field
              label="Store reference"
              hint="The retailer's own branch number or code."
            >
              <Input
                value={
                  locationForm.externalReference
                }
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    externalReference:
                      event.target.value,
                  })
                }
                placeholder="Store 4821"
              />
            </Field>

            <Field label="Address">
              <Input
                value={locationForm.address}
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    address: event.target.value,
                  })
                }
                placeholder="5 Wall Street"
              />
            </Field>

            <Field label="City">
              <Input
                value={locationForm.city}
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    city: event.target.value,
                  })
                }
                placeholder="Liverpool"
              />
            </Field>

            <Field label="Postcode">
              <Input
                value={locationForm.postcode}
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    postcode:
                      event.target.value,
                  })
                }
                placeholder="L1 8JQ"
              />
            </Field>

            <Field label="Country code">
              <Input
                value={
                  locationForm.countryCode
                }
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    countryCode:
                      event.target.value,
                  })
                }
                maxLength={2}
                placeholder="GB"
              />
            </Field>

            <Field
              label="Latitude"
              hint="Optional store coordinate."
            >
              <Input
                type="number"
                step="any"
                value={locationForm.latitude}
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    latitude:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field
              label="Longitude"
              hint="Optional store coordinate."
            >
              <Input
                type="number"
                step="any"
                value={locationForm.longitude}
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    longitude:
                      event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Status">
              <Select
                value={
                  locationForm.active
                    ? 'active'
                    : 'inactive'
                }
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    active:
                      event.target.value ===
                      'active',
                  })
                }
              >
                <option value="active">
                  Active
                </option>
                <option value="inactive">
                  Inactive
                </option>
              </Select>
            </Field>
          </div>

          {error ? (
            <p className="error">{error}</p>
          ) : null}

          <div className="form-actions">
            <Button
              type="button"
              className="secondary"
              onClick={() =>
                setLocationModalOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() =>
                void saveLocation()
              }
              disabled={saving}
            >
              Save store location
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
