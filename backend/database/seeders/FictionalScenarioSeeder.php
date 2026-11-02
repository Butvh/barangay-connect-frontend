<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/** Disposable, fictional fixtures; never a provisioning or production data import. */
class FictionalScenarioSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new \LogicException('fictional_seeder_forbidden');
        }
        DB::transaction(function () {
            $at = now();
            foreach ([1, 2] as $scope) {
                DB::table('barangays')->insert(['id' => $scope, 'name' => 'Fictional Barangay '.$scope, 'map_scope' => null, 'created_at' => $at, 'updated_at' => $at]);
                DB::table('households')->insert(['id' => $scope, 'barangay_id' => $scope, 'address' => 'Fictional District '.$scope, 'map_x' => 0, 'map_y' => 0, 'created_at' => $at, 'updated_at' => $at]);
                $base = ($scope - 1) * 100;
                $roles = [1 => 'captain', 2 => 'secretary', 3 => 'responder', 4 => 'rescuer', 5 => 'resident', 6 => 'tanod', 7 => 'responder', 8 => 'unassigned', 9 => 'secretary', 10 => 'secretary'];
                for ($i = 11; $i <= 20; $i++) {
                    $roles[$i] = 'resident';
                }
                foreach ($roles as $offset => $role) {
                    $id = $base + $offset;
                    DB::table('users')->insert(['id' => $id, 'barangay_id' => $scope, 'household_id' => $role === 'resident' ? $scope : null,
                        'full_name' => 'Fictional '.$role.' '.$id, 'email' => 'fixture-'.$id.'@example.invalid', 'password' => Hash::make(Str::random(48)),
                        'is_resident' => in_array($role, ['resident', 'responder', 'tanod'], true), 'is_captain' => $role === 'captain',
                        'account_status' => 'Active', 'contact_number' => null, 'created_at' => $at, 'updated_at' => $at]);
                    if (in_array($offset, [3, 6], true)) {
                        DB::table('tanod_memberships')->insert(['user_id' => $id, 'barangay_id' => $scope, 'pool_reference' => 'fictional-'.$id, 'created_at' => $at, 'updated_at' => $at]);
                    }
                    if (in_array($role, ['secretary', 'responder', 'rescuer', 'unassigned'], true)) {
                        DB::table('personnel_appointments')->insert(['user_id' => $id, 'barangay_id' => $scope, 'role' => $role === 'unassigned' ? null : $role,
                            'source' => $offset === 3 ? 'tanod' : null, 'status' => $role === 'unassigned' ? 'Unassigned' : ($offset === 7 ? 'Inactive' : 'Active'),
                            'legacy' => true, 'created_at' => $at, 'updated_at' => $at]);
                    }
                }
                foreach (['Pending', 'Resubmission requested', 'Approved', 'Rejected', 'Expired'] as $index => $status) {
                    $resident = $base + 5 + ($index === 0 ? 0 : $index + 5);
                    $application = DB::table('verifications')->insertGetId(['resident_id' => $resident, 'barangay_id' => $scope, 'review_status' => $status,
                        'deadline_at' => $status === 'Pending' ? $at->copy()->addDays(7) : null, 'created_at' => $at, 'updated_at' => $at]);
                    $submission = DB::table('verification_submissions')->insertGetId(['verification_id' => $application, 'barangay_id' => $scope, 'revision' => 1, 'submitted_at' => $at]);
                    DB::table('verifications')->where('id', $application)->update(['current_submission_id' => $submission]);
                    DB::table('documents')->insert(['barangay_id' => $scope, 'submission_id' => $submission, 'uploader_id' => $resident, 'object_key' => 'fictional/'.$submission.'/valid-id.pdf',
                        'original_name' => 'fictional-valid-id.pdf', 'kind' => 'valid_id', 'mime' => 'application/pdf', 'bytes' => 32, 'created_at' => $at, 'updated_at' => $at]);
                }
                for ($index = 0; $index < 4; $index++) {
                    $alert = DB::table('emergency_alerts')->insertGetId(['barangay_id' => $scope, 'resident_id' => $base + 15 + $index, 'household_id' => $scope,
                        'alert_type' => 'Flood', 'location_label' => 'Fictional district', 'status' => $index === 3 ? 'Resolved' : 'Acknowledged',
                        'reported_at' => $at, 'victim_count' => $index === 0 ? 0 : null, 'map_x' => 0, 'map_y' => 0, 'created_at' => $at, 'updated_at' => $at]);
                    if ($index < 2) {
                        DB::table('alert_assignments')->insert(['alert_id' => $alert, 'barangay_id' => $scope, 'user_id' => $base + 3, 'role' => 'responder', 'status' => 'active', 'assigned_by' => $base + 1, 'assigned_at' => $at, 'created_at' => $at, 'updated_at' => $at]);
                    }
                    if ($index === 1) {
                        DB::table('alert_assignments')->insert(['alert_id' => $alert, 'barangay_id' => $scope, 'user_id' => $base + 4, 'role' => 'rescuer', 'status' => 'active', 'assigned_by' => $base + 1, 'assigned_at' => $at, 'created_at' => $at, 'updated_at' => $at]);
                    }
                }
                DB::table('facilities')->insert(['managed_by_barangay_id' => $scope, 'visibility' => $scope === 1 ? 'shared' : 'local', 'name' => 'Fictional facility '.$scope,
                    'type' => $scope === 1 ? 'Hospital' : 'Evacuation Center', 'address' => 'Fictional facility address', 'active' => $scope === 1, 'created_at' => $at, 'updated_at' => $at]);
                $alerts = DB::table('emergency_alerts')->where('barangay_id', $scope)->orderBy('id')->pluck('id');
                $assessment = DB::table('alert_assignments')->where('alert_id', $alerts[1])->where('role', 'responder')->value('id');
                DB::table('alert_responses')->insert(['alert_id' => $alerts[1], 'assignment_id' => $assessment, 'responder_id' => $base + 3, 'response_type' => 'Assessment', 'response_status' => 'Responding', 'rescue_required' => true, 'responded_at' => $at, 'created_at' => $at, 'updated_at' => $at]);
                $completed = DB::table('alert_assignments')->insertGetId(['alert_id' => $alerts[2], 'barangay_id' => $scope, 'user_id' => $base + 3, 'role' => 'responder', 'status' => 'completed', 'assigned_by' => $base + 1, 'assigned_at' => $at, 'ended_at' => $at, 'created_at' => $at, 'updated_at' => $at]);
                DB::table('alert_responses')->insert(['alert_id' => $alerts[2], 'assignment_id' => $completed, 'responder_id' => $base + 3, 'response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => false, 'responded_at' => $at, 'created_at' => $at, 'updated_at' => $at]);
                $rescue = DB::table('alert_assignments')->where('alert_id', $alerts[1])->where('role', 'rescuer')->value('id');
                DB::table('rescues')->insert(['alert_id' => $alerts[1], 'assignment_id' => $rescue, 'rescuer_id' => $base + 4, 'facility_id' => $scope,
                    'destination_snapshot' => json_encode(['id' => $scope, 'name' => 'Fictional facility '.$scope, 'type' => $scope === 1 ? 'Hospital' : 'Evacuation Center', 'address' => 'Fictional facility address', 'status' => 'Active']), 'rescue_status' => 'Completed', 'rescued_at' => $at, 'created_at' => $at, 'updated_at' => $at]);
                foreach (['complaint', 'suggestion', 'general'] as $kind) {
                    DB::table('community_feedback')->insert(['barangay_id' => $scope, 'resident_id' => $base + 5, 'kind' => $kind,
                        'status' => $kind === 'general' ? null : 'Pending', 'rating' => $kind === 'general' ? 4 : null,
                        'comment' => $kind === 'general' ? 'Fictional community feedback.' : null, 'description' => $kind === 'general' ? null : 'Fictional request.', 'submitted_at' => $at, 'created_at' => $at, 'updated_at' => $at]);
                }
            }
        });
    }
}
